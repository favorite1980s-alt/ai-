// Based on Kami Subs' local tab-capture architecture; MIT attribution in THIRD_PARTY_NOTICES.md.
const OFFSCREEN_URL = "offscreen.html";
const DICTIONARY_PATH = "data/words.json";
const IRREGULAR = Object.freeze({
  went:"go",gone:"go",was:"be",were:"be",been:"be",had:"have",
  did:"do",does:"do",done:"do",brought:"bring",thought:"think",
  said:"say",told:"tell",knew:"know",known:"know",took:"take",
  taken:"take",made:"make",gave:"give",given:"give",saw:"see",
  seen:"see",found:"find",felt:"feel",left:"leave",got:"get",
  gotten:"get",wrote:"write",written:"write",bought:"buy",
  caught:"catch",ran:"run",ate:"eat",eaten:"eat",spoke:"speak",
  spoken:"speak",drove:"drive",driven:"drive",broke:"break",
  broken:"break",chose:"choose",chosen:"choose",sang:"sing",
  sung:"sing",flew:"fly",flown:"fly",slept:"sleep",stood:"stand"
});
let dictionaryPromise = null;
async function getDictionary(){
  if (!dictionaryPromise) {
    dictionaryPromise = (async()=>{
      const response = await fetch(chrome.runtime.getURL(DICTIONARY_PATH));
      if (!response.ok) throw Error("Large dictionary is missing. Run install.bat again.");
      const data = await response.json();
      if (Object.keys(data).length < 40000) throw Error("Dictionary data is incomplete.");
      return data;
    })().catch(error => {
      dictionaryPromise = null; // allow retry after extension update
      console.warn("[Movie English Study] Dictionary not ready:", String(error));
      return null;
    });
  }
  return dictionaryPromise;
}
function lookupForms(word){
  if (typeof word !== "string") return [];
  const key=word.toLowerCase().replace(/[’]/g,"'").replace(/^[^a-z]+|[^a-z']+$/g,"");
  if (!key) return [];
  const forms=[key];
  if (IRREGULAR[key]) forms.push(IRREGULAR[key]);
  if (key.endsWith("'s")) forms.push(key.slice(0,-2));
  if (key.endsWith("ies")) forms.push(key.slice(0,-3)+"y");
  if (key.endsWith("ves")) forms.push(key.slice(0,-3)+"f",key.slice(0,-3)+"fe");
  if (key.endsWith("ing")) forms.push(key.slice(0,-3),key.slice(0,-3)+"e");
  if (key.endsWith("ied")) forms.push(key.slice(0,-3)+"y");
  if (key.endsWith("ed")) forms.push(key.slice(0,-2),key.slice(0,-1));
  if (key.endsWith("es")) forms.push(key.slice(0,-2));
  if (key.endsWith("s")) forms.push(key.slice(0,-1));
  return [...new Set(forms)];
}
function lookupDictionary(data,word){
  if (!data) return null;
  for (const candidate of lookupForms(word)){
    const entry = Object.prototype.hasOwnProperty.call(data,candidate) ? data[candidate] : null;
    if (entry && typeof entry.meaning_ko==="string" && entry.meaning_ko.trim()){
      return {word:candidate,meaning:entry.meaning_ko,ipa:entry.ipa||"",pos:entry.pos||"",source:"open-english-korean-dict"};
    }
  }
  return null;
}

let wsState = "idle";
async function getSession() {
  const state = await chrome.storage.session.get(["activeTabId", "capturing"]);
  return { tabId: state.activeTabId ?? null, capturing: !!state.capturing };
}
async function hasOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)]
  });
  return contexts.length > 0;
}
async function ensureOffscreen() {
  if (!(await hasOffscreen())) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["USER_MEDIA"],
      justification: "Capture audio from the selected video tab for local speech recognition"
    });
  }
}
async function tellTab(tabId, message) {
  if (tabId == null) return;
  try { await chrome.tabs.sendMessage(tabId, message); } catch (_) {}
}
async function ensureOverlay(tabId) {
  try {
    const reply = await chrome.tabs.sendMessage(tabId, {type:"ping"});
    if (reply?.ok) return;
  } catch (_) {}
  await chrome.scripting.insertCSS({target:{tabId},files:["content.css"]});
  await chrome.scripting.executeScript({target:{tabId},files:["lexicon.js","content.js"]});
}
async function stopCapture() {
  const state = await getSession();
  await chrome.storage.session.set({capturing:false,activeTabId:null,wsState:"idle"});
  if (await hasOffscreen()) {
    try { await chrome.runtime.sendMessage({target:"offscreen",type:"stop"}); } catch (_) {}
  }
  await tellTab(state.tabId,{type:"overlay:unmount"});
  wsState = "idle";
}
async function startCapture(tabId) {
  const prior = await getSession();
  if (prior.capturing) await stopCapture();
  // This must happen first: tabCapture requires the user-initiated extension action.
  const streamId = await chrome.tabCapture.getMediaStreamId({targetTabId:tabId});
  if (!streamId) throw Error("탭 오디오를 캡처하지 못했습니다.");
  try {
    await ensureOffscreen();
    await ensureOverlay(tabId);
    await tellTab(tabId,{type:"overlay:mount"});
    // Register the capture before asking the offscreen document to open WebSocket.
    // Otherwise, fast 'connected' callbacks race with, and are overwritten by,
    // a late 'connecting' status write, leaving the popup stuck.
    await chrome.storage.session.set({capturing:true,activeTabId:tabId,wsState:"connecting"});
    wsState = "connecting";
    const started = await chrome.runtime.sendMessage({
      target:"offscreen",type:"start",streamId,
      settings:{sourceLang:"en",targetLang:"en",task:"transcribe"}
    });
    if (!started?.ok) throw Error(started?.error || "오디오 캡처 시작 실패");
  } catch (error) {
    // Undo the UI, tab, and session state on any partial startup failure.
    await stopCapture();
    throw error;
  }
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || (msg.target && msg.target !== "background")) return false;
  (async () => {
    switch (msg.type) {
      case "dictionary:lookup": {
        const data=await getDictionary();
        return {ok:true,entry:lookupDictionary(data,msg.word),fullDictionaryLoaded:!!data};
      }
      case "dictionary:status": {
        const data=await getDictionary();
        return {ok:true,loaded:!!data,entries:data?Object.keys(data).length:0};
      }
      case "capture:start": {
        const tabId = Number(msg.tabId);
        if (!Number.isInteger(tabId)) throw Error("탭을 선택할 수 없습니다.");
        await startCapture(tabId); return {ok:true};
      }
      case "capture:stop": await stopCapture(); return {ok:true};
      case "capture:status": {
        const state=await getSession();
        const session=await chrome.storage.session.get("wsState");
        return {ok:true,...state,wsState:session.wsState||wsState};
      }
      case "overlay:demo": {
        const tabId=Number(msg.tabId);
        if(!Number.isInteger(tabId))throw Error("영화 탭을 열어 주세요.");
        await ensureOverlay(tabId);
        await tellTab(tabId,{type:"overlay:mount"});
        await tellTab(tabId,{type:"overlay:text",text:"Do you want to go somewhere? Let's learn English together."});
        return {ok:true};
      }
      case "ws:state":
        wsState = String(msg.state);
        await chrome.storage.session.set({wsState});
        return {ok:true};
      case "transcript": {
        const state = await getSession();
        if (state.capturing && sender.id === chrome.runtime.id)
          await tellTab(state.tabId,{type:"overlay:text",text:String(msg.text||"").slice(0,500)});
        return {ok:true};
      }
      case "backend:error": {
        const state = await getSession();
        await tellTab(state.tabId,{type:"overlay:error",message:String(msg.message||"서버 오류").slice(0,160)});
        return {ok:true};
      }
      default: return {ok:false,error:"Unknown command"};
    }
  })().then(sendResponse).catch(error => sendResponse({ok:false,error:String(error.message||error)}));
  return true;
});
chrome.tabs.onRemoved.addListener(async tabId => {
  if ((await getSession()).tabId === tabId) await stopCapture();
});
chrome.tabs.onUpdated.addListener(async (tabId, change) => {
  if (change.status === "loading" && (await getSession()).tabId === tabId) await stopCapture();
});
