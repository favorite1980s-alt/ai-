// Test background.js dictionary lookup with real 48k+ word data and mocked Chrome APIs.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const dict=JSON.parse(fs.readFileSync(path.join(root,'extension/data/words.json'),'utf8'));
const listeners=[];
let fetchCalls=0;
const chrome={
 runtime:{id:'test-extension',getURL:p=>'chrome-extension://test/'+p,
   onMessage:{addListener:fn=>listeners.push(fn)}},
 tabs:{onRemoved:{addListener(){}},onUpdated:{addListener(){}}},
 storage:{session:{get:async()=>({}),set:async()=>{}}},
};
const source=fs.readFileSync(path.join(root,'extension/background.js'),'utf8');
vm.runInNewContext(source,{chrome,console,fetch:async()=>{
 fetchCalls++;return {ok:true,json:async()=>dict};}}, {filename:'background.js'});
assert.equal(listeners.length,1);
function send(msg){
 return new Promise((resolve,reject)=>{
   const t=setTimeout(()=>reject(Error('Timed out: '+msg.type)),10000);
   const returned=listeners[0]({target:'background',...msg},{id:'test-extension'},r=>{
      clearTimeout(t);resolve(r);
   });
   assert.equal(returned,true);
 });
}
(async()=>{
 const status=await send({type:'dictionary:status'});
 assert.equal(status.loaded,true);
 assert.ok(status.entries>=48000);
 const somewhere=await send({type:'dictionary:lookup',word:'somewhere'});
 assert.ok(somewhere.entry && somewhere.entry.meaning);
 assert.match(somewhere.entry.meaning,/어딘가|어떤 곳|어디/);
 const irregular=await send({type:'dictionary:lookup',word:'went'});
 assert.ok(irregular.entry && irregular.entry.meaning);
 const unknown=await send({type:'dictionary:lookup',word:'no-such-mes-vocabulary-zzxyq'});
 assert.equal(unknown.entry,null);
 assert.equal(fetchCalls,1,'Full dictionary must be loaded only once per service worker lifetime');
 console.log('PASS 48k dictionary service worker lookup, conjugation and cache, entries:',status.entries);
})().catch(e=>{console.error(e);process.exitCode=1;});
