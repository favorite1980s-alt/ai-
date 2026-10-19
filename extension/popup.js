const $=id=>document.getElementById(id);
let busy=false;
let saveWords={};
function safeWord(word){return typeof word==="string"?word.slice(0,90):"";}
function renderWords(){
  const host=$("wordList");
  host.replaceChildren();
  const q=$("wordSearch").value.trim().toLowerCase();
  const matches=Object.values(saveWords).filter(w=>w && typeof w.word==="string"
      && (!q||w.word.toLowerCase().includes(q)||(w.meaning||"").includes(q)))
    .sort((a,b)=>String(b.at||"").localeCompare(String(a.at||""))).slice(0,30);
  if(!matches.length){
    const msg=document.createElement("p");
    msg.className="empty";msg.textContent=q?"검색 결과가 없습니다.":"아직 저장된 단어가 없습니다.";
    host.appendChild(msg);return;
  }
  for(const w of matches){
    const item=document.createElement("div");item.className="word-item";
    const content=document.createElement("div");content.className="word-body";
    const title=document.createElement("strong");title.textContent=safeWord(w.word);
    const meaning=document.createElement("span");meaning.textContent=String(w.meaning||"").slice(0,160);
    content.append(title,meaning);
    if(w.example){
      const example=document.createElement("small");example.textContent=String(w.example).slice(0,240);
      content.appendChild(example);
    }
    const del=document.createElement("button");del.type="button";del.className="delete-word";
    del.title="단어 삭제";del.textContent="✕";
    del.addEventListener("click",async()=>{
      const result=await chrome.storage.local.get("savedWords");
      const words=result.savedWords||{};
      delete words[w.word.toLowerCase()];
      await chrome.storage.local.set({savedWords:words});
      await refresh();
    });
    item.append(content,del);host.appendChild(item);
  }
}

async function send(type, extra={}) {return chrome.runtime.sendMessage({target:"background",type,...extra});}
async function activeTab(){const tabs=await chrome.tabs.query({active:true,currentWindow:true});return tabs[0]?.id;}
async function refresh(){
  try {
    const result=await send("capture:status");
    const capturing=!!result?.capturing;
    $("dot").className="dot"+(capturing&&result.wsState==="connected"?" live":result.wsState==="error"?" error":"");
    $("status").textContent=result.lastError && result.wsState!=="connected"
      ? "오류: "+result.lastError
      : !capturing?"대기 중 · 로컬 서버를 먼저 실행하세요":
      result.wsState==="connected"?"영어 음성 인식 중":result.wsState==="connecting"?"서버 연결 중...":
      "오디오 캡처 중 · 서버 연결 확인 필요";
    $("toggle").textContent=capturing?"■ 자막 중단":"▶ 영어 자막 시작";
    $("toggle").classList.toggle("stop",capturing);
  }catch(e){$("status").textContent="상태 확인 실패: "+e.message;}
  const stored=await chrome.storage.local.get("savedWords");
  saveWords=stored.savedWords||{};
  $("wordCount").textContent=Object.keys(saveWords).length+"개";
  renderWords();
}
$("wordSearch").addEventListener("input",renderWords);
$("pauseOnLookup").addEventListener("change",async()=>{
  await chrome.storage.local.set({pauseOnLookup:$("pauseOnLookup").checked});
});
chrome.storage.local.get("pauseOnLookup").then(data=>{
  $("pauseOnLookup").checked=data.pauseOnLookup!==false;
});
$("toggle").addEventListener("click",async()=>{
  if(busy)return;busy=true;$("toggle").disabled=true;
  try{
    const state=await send("capture:status");
    const res=state?.capturing?await send("capture:stop"):
       await send("capture:start",{tabId:await activeTab()});
    if(!res?.ok) throw Error(res?.error||"실행 실패");
  }catch(e){$("status").textContent="오류: "+e.message;$("dot").className="dot error";}
  finally{busy=false;$("toggle").disabled=false;await refresh();}
});
$("demo").addEventListener("click",async()=>{
  try{
    const res=await send("overlay:demo",{tabId:await activeTab()});
    if(!res?.ok)throw Error(res?.error||"동작 실패");
    $("status").textContent="예시 표시됨: 영화 탭에서 단어를 눌러보세요.";
  }catch(e){$("status").textContent="예시 실패: "+e.message;}
});
$("clear").addEventListener("click",async()=>{
  if(!confirm("저장한 단어를 모두 삭제하시겠습니까?"))return;
  await chrome.storage.local.set({savedWords:{}});await refresh();
});
$("export").addEventListener("click",async()=>{
  const s=await chrome.storage.local.get("savedWords");
  const words=Object.values(s.savedWords||{});
  if(!words.length){$("status").textContent="저장된 단어가 없습니다.";return;}
  const lines=["word\tmeaning\tsaved_at\texample",...words.map(w=>[w.word,w.meaning,w.at,w.example||""].map(v=>String(v||"").replace(/[\t\r\n]+/g," ")).join("\t"))];
  const blob=new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/tab-separated-values;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="movie-english-words.tsv";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
});
$("dictionary").addEventListener("change",async e=>{
  const file=e.target.files?.[0];if(!file)return;
  if(file.size>2*1024*1024){$("dictStatus").textContent="파일 크기는 2MB 이하만 가능합니다.";return;}
  try{
    const text=await file.text();const words={};
    for(const line of text.split(/\r?\n/)){
      const cols=line.includes("\t")?line.split("\t"):line.split(",");
      const key=(cols[0]||"").trim().toLowerCase();
      const meaning=(cols.slice(1).join(",")||"").trim().slice(0,240);
      if(/^[a-z]+(?:[-'][a-z]+)*$/.test(key)&&meaning)words[key]=meaning;
      if(Object.keys(words).length>=5000)break;
    }
    const prev=(await chrome.storage.local.get("userDictionary")).userDictionary||{};
    await chrome.storage.local.set({userDictionary:{...prev,...words}});
    $("dictStatus").textContent=Object.keys(words).length+"개 단어를 가져왔습니다.";
  }catch(err){$("dictStatus").textContent="가져오기 실패: "+err.message;}
});
async function checkDictionary(){
  try {
    const res=await send("dictionary:status");
    $("dictionaryCount").textContent=res?.loaded
      ? "✓ 오프라인 영한사전 "+Number(res.entries).toLocaleString("ko-KR")+"개 준비 완료"
      : "⚠ 대형 사전 미설치 · install.bat 실행 필요 (임시 337개)";
  }catch(_){$("dictionaryCount").textContent="사전 확인 오류 · 크롬 확장 프로그램 새로고침 필요";}
}
checkDictionary();
refresh();setInterval(refresh,1400);
