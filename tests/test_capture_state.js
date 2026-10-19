// Reproduce early WS connected callback and failed audio capture startup.
// A real tab audio source and Whisper inference are NOT exercised here.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../extension/background.js'),'utf8');
const state={};
let handler, captureResponse={ok:true}, overlaySeen=[];
const runtime={
 id:'test-id',
 getURL:p=>'chrome-extension://test-id/'+p,
 onMessage:{addListener:fn=>handler=fn},
 getContexts:async()=>[{contextType:'OFFSCREEN_DOCUMENT'}],
 sendMessage:async msg=>{
   if(msg.target==='offscreen' && msg.type==='start'){
     // Simulate ultra-fast connection before offscreen's start response resolves.
     await invoke({type:'ws:state',state:'connected'});
     return captureResponse;
   }
   return {ok:true};
 }
};
const chrome={
 runtime,
 storage:{session:{
   get:async keys=>(Array.isArray(keys)?keys:[keys]).reduce((r,k)=>(r[k]=state[k],r),{}),
   set:async update=>Object.assign(state,update)
 }},
 offscreen:{createDocument:async()=>{}},
 tabCapture:{getMediaStreamId:async()=>('fake-tab-stream')},
 scripting:{insertCSS:async()=>{},executeScript:async()=>{}},
 tabs:{
   sendMessage:async(tabId,msg)=>{overlaySeen.push(msg.type);return {ok:true};},
   onRemoved:{addListener(){}},
   onUpdated:{addListener(){}}
 }
};
vm.runInNewContext(source,{chrome,console,fetch:async()=>{throw Error('not used');}},{filename:'background.js'});
async function invoke(data){
 return new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('background response timed out: '+data.type)),5000);
   handler({target:'background',...data},{id:'test-id'},r=>{clearTimeout(timeout);resolve(r);});
 });
}
(async()=>{
 const first=await invoke({type:'capture:start',tabId:42});
 assert.equal(first.ok,true);
 const status=await invoke({type:'capture:status'});
 assert.equal(status.capturing,true);
 assert.equal(status.wsState,'connected','Early WebSocket connected must never be overwritten');
 assert.ok(overlaySeen.includes('overlay:mount'));
 await invoke({type:'capture:stop'});
 const stopStatus=await invoke({type:'capture:status'});
 assert.equal(stopStatus.capturing,false);
 assert.equal(stopStatus.wsState,'idle');
 captureResponse={ok:false,error:'sample failure'};
 const failed=await invoke({type:'capture:start',tabId:42});
 assert.equal(failed.ok,false);
 const afterFail=await invoke({type:'capture:status'});
 assert.equal(afterFail.capturing,false,'Partial startup must clean up capture flag');
 assert.equal(afterFail.tabId,null);
 assert.ok(overlaySeen.includes('overlay:unmount'),'Failed startup must remove overlay');
 console.log('PASS startup WS state race, stop, failed startup rollback');
})().catch(e=>{console.error(e);process.exitCode=1;});
