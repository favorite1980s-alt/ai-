// Based on Kami Subs' local tab-capture architecture; MIT attribution in THIRD_PARTY_NOTICES.md.
const OFFSCREEN_URL = "offscreen.html";
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
  await chrome.storage.session.set({capturing:false,activeTabId:null});
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
  await ensureOffscreen();
  await ensureOverlay(tabId);
  await tellTab(tabId,{type:"overlay:mount"});
  const started = await chrome.runtime.sendMessage({
    target:"offscreen",type:"start",streamId,
    settings:{sourceLang:"en",targetLang:"en",task:"transcribe"}
  });
  if (!started?.ok) {
    await tellTab(tabId,{type:"overlay:unmount"});
    throw Error(started?.error || "오디오 캡처 시작 실패");
  }
  await chrome.storage.session.set({capturing:true,activeTabId:tabId});
  wsState = "connecting";
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || (msg.target && msg.target !== "background")) return false;
  (async () => {
    switch (msg.type) {
      case "capture:start": {
        const tabId = Number(msg.tabId);
        if (!Number.isInteger(tabId)) throw Error("탭을 선택할 수 없습니다.");
        await startCapture(tabId); return {ok:true};
      }
      case "capture:stop": await stopCapture(); return {ok:true};
      case "capture:status": return {ok:true,...(await getSession()),wsState};
      case "ws:state": wsState = String(msg.state); return {ok:true};
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
