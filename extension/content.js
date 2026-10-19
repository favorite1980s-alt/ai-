/* Clickable caption overlay with offline glossary, inspired by Sublens' learning UX.
 * No Sublens source code is copied. Only the locally generated English captions are clickable.
 */
(() => {
  if (globalThis.__MES_CONTENT_LOADED__) return;
  globalThis.__MES_CONTENT_LOADED__ = true;
  const ID="mes-caption-root";
  const WORD_RE=/[A-Za-z]+(?:['’][A-Za-z]+)*/g;
  let root=null, line=null, card=null, clearTimer=null, lastLine="";
  let userDictionary={};
  chrome.storage.local.get("userDictionary").then(x=>{
    userDictionary=x.userDictionary || {};
  });
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==="local" && changes.userDictionary) userDictionary=changes.userDictionary.newValue || {};
  });
  function host(){return document.fullscreenElement || document.webkitFullscreenElement || document.documentElement;}
  function moveHost(){if(root?.isConnected && root.parentElement!==host())host().appendChild(root);}
  document.addEventListener("fullscreenchange",moveHost);
  document.addEventListener("webkitfullscreenchange",moveHost);
  function mount(){
    if(root?.isConnected){moveHost();return;}
    document.querySelectorAll("#"+ID).forEach(n=>n.remove());
    root=document.createElement("section");
    root.id=ID;
    root.setAttribute("aria-label","클릭 가능한 실시간 영어 자막");
    line=document.createElement("div");
    line.className="mes-line";
    root.appendChild(line);
    host().appendChild(root);
  }
  function dismiss(){if(card){card.remove();card=null;}}
  function unmount(){
    clearTimeout(clearTimer);dismiss();
    document.querySelectorAll("#"+ID).forEach(n=>n.remove());
    root=null;line=null;lastLine="";
  }
  async function save(word,gloss){
    const stored=await chrome.storage.local.get("savedWords");
    const old=stored.savedWords || {};
    old[word.toLowerCase()]={word:word.toLowerCase(),meaning:gloss,at:new Date().toISOString()};
    await chrome.storage.local.set({savedWords:old});
  }
  function openCard(word,anchor){
    dismiss();
    if(!root)return;
    clearTimeout(clearTimer);
    // Use the user's local translation first, then the verified 48k+ offline JSON,
    // then the 337-word fallback dictionary if the large data is not installed.
    const own=globalThis.MESDictionary.lookup(word,userDictionary);
    let meaning=own || null;
    card=document.createElement("aside");card.className="mes-card";
    const title=document.createElement("strong");title.textContent=word.toLowerCase();
    const definition=document.createElement("div");definition.className="mes-meaning";
    definition.textContent=meaning || "사전 검색 중...";
    const tools=document.createElement("div");tools.className="mes-tools";
    const speak=document.createElement("button");speak.type="button";speak.textContent="🔊 발음";
    speak.addEventListener("click",()=>{
      if(!("speechSynthesis" in window))return;
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(word);u.lang="en-US";u.rate=0.82;speechSynthesis.speak(u);
    });
    const keep=document.createElement("button");keep.type="button";keep.textContent="☆ 저장";
    keep.disabled=!meaning;
    keep.addEventListener("click",async()=>{
      try{await save(word,meaning);keep.textContent="✓ 저장됨";}catch(_){keep.textContent="저장 실패";}
    });
    const close=document.createElement("button");close.type="button";close.textContent="✕ 닫기";
    close.addEventListener("click",dismiss);
    tools.append(speak,keep,close);card.append(title,definition,tools);root.appendChild(card);
    const activeCard=card;
    chrome.runtime.sendMessage({target:"background",type:"dictionary:lookup",word})
      .then(result=>{
        if (!activeCard.isConnected) return;
        // Explicit user-supplied glossary has priority over bundled open dictionary.
        const found=result?.entry;
        const userKey=word.toLowerCase().replace(/[’]/g,"'");
        meaning=Object.prototype.hasOwnProperty.call(userDictionary,userKey)
          ? userDictionary[userKey] : (found?.meaning || own);
        definition.textContent=meaning ||
          (result?.fullDictionaryLoaded
            ? "사전에서 찾지 못했습니다. 사용자 사전에 등록할 수 있습니다."
            : "대형 영한사전이 설치되지 않았습니다. install.bat을 실행하세요.");
        if (found?.ipa) {
          const ipa=document.createElement("div");
          ipa.className="mes-ipa";
          ipa.textContent="발음 기호: "+found.ipa;
          definition.after(ipa);
        }
        keep.disabled=!meaning;
      }).catch(()=>{
        if(!activeCard.isConnected)return;
        meaning=own;
        definition.textContent=meaning || "사전 연결 오류. Chrome 확장 프로그램을 새로고침하세요.";
        keep.disabled=!meaning;
      });
  }
  function paint(text){
    mount();
    // Keep an open word card visible so the user can finish reviewing a word.
    if(card?.isConnected)return;
    const fresh=String(text||"").trim().slice(-240);
    lastLine=fresh;
    line.replaceChildren();
    if(!fresh){root.classList.remove("mes-visible");return;}
    let at=0;
    for(const match of fresh.matchAll(WORD_RE)){
      const idx=match.index; if(idx>at)line.appendChild(document.createTextNode(fresh.slice(at,idx)));
      const btn=document.createElement("button");btn.type="button";btn.className="mes-word";
      btn.textContent=match[0];btn.title=match[0]+" 뜻 보기";
      btn.addEventListener("click",()=>openCard(match[0],btn));
      line.appendChild(btn);at=idx+match[0].length;
    }
    if(at<fresh.length)line.appendChild(document.createTextNode(fresh.slice(at)));
    root.classList.add("mes-visible");
    clearTimeout(clearTimer);
    clearTimer=setTimeout(()=>{if(root && !card){root.classList.remove("mes-visible");line.replaceChildren();}},8000);
  }
  function showError(message){paint("⚠ "+String(message).slice(0,90));}
  chrome.runtime.onMessage.addListener((msg,_sender,reply)=>{
    if(!msg)return false;
    switch(msg.type){
      case "ping":reply({ok:true});return false;
      case "overlay:mount":mount();break;
      case "overlay:unmount":unmount();break;
      case "overlay:text":paint(msg.text);break;
      case "overlay:error":showError(msg.message);break;
    }
    reply({ok:true});return false;
  });
})();
