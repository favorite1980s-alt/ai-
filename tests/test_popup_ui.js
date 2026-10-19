// Real Chromium popup rendering/storage test using stubbed Chrome APIs.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const puppeteer=require('puppeteer-core');
const root=path.join(__dirname,'..');
const candidates=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].filter(Boolean);
const chromePath=candidates.find(p=>fs.existsSync(p));
if(!chromePath)throw Error('Chrome binary not found');
(async()=>{
const browser=await puppeteer.launch({executablePath:chromePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
  const page=await browser.newPage();
  const html=fs.readFileSync(path.join(root,'extension/popup.html'),'utf8').replace('<script src="popup.js"></script>','');
  await page.setContent(html);
  await page.evaluate(()=>{
    const data={
      savedWords:{
        somewhere:{word:'somewhere',meaning:'어딘가',example:'We met somewhere.',at:'2026-01-01'},
        extraordinary:{word:'extraordinary',meaning:'대단한',example:'Extraordinary!',at:'2026-01-02'}
      },
      pauseOnLookup:true
    };
    window.__store=data;
    window.chrome={
      storage:{local:{
        get:async key=>typeof key==='string'?{[key]:data[key]}:data,
        set:async update=>Object.assign(data,update)
      }},
      runtime:{sendMessage:async msg=>{
        if(msg.type==='capture:status')return {ok:true,capturing:false,wsState:'idle'};
        if(msg.type==='dictionary:status')return {ok:true,loaded:true,entries:48037};
        return {ok:true};
      }},
      tabs:{query:async()=>[{id:10}]}
    };
  });
  await page.addStyleTag({path:path.join(root,'extension/popup.css')});
  await page.addScriptTag({path:path.join(root,'extension/popup.js')});
  await page.waitForFunction(()=>document.querySelector('#wordCount').textContent==='2개');
  assert.equal(await page.$$eval('.word-item',x=>x.length),2);
  assert.ok((await page.$eval('#dictionaryCount',x=>x.textContent)).includes('48,037'));
  await page.type('#wordSearch','extra');
  assert.equal(await page.$$eval('.word-item',x=>x.length),1);
  assert.match(await page.$eval('.word-item small',x=>x.textContent),/Extraordinary/);
  await page.click('.delete-word');
  await page.waitForFunction(()=>document.querySelector('#wordCount').textContent==='1개');
  assert.equal(await page.evaluate(()=>!!window.__store.savedWords.extraordinary),false);
  await page.click('#wordSearch',{clickCount:3});
  await page.evaluate(()=>{document.querySelector('#wordSearch').value='';document.querySelector('#wordSearch').dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.$$eval('.word-item',x=>x.length),1);
  await page.click('#pauseOnLookup');
  assert.equal(await page.evaluate(()=>window.__store.pauseOnLookup),false);
  console.log('PASS popup search/delete wordbook, stored sentence, dictionary status, pause preference');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
