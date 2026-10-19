// Chromium UI integration: real DOM rendering, mocked Chrome messaging and offline dictionary.
// This does NOT verify live microphone/tabCapture or Whisper model inference.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const root = path.join(__dirname, '..');
const lexicon = JSON.parse(fs.readFileSync(path.join(root, 'extension/data/words.json'), 'utf8'));
const candidates = [process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].filter(Boolean);
const executablePath = candidates.find(p=>fs.existsSync(p));
if (!executablePath) throw Error('No system Chrome found on CI runner.');
(async () => {
  const browser = await puppeteer.launch({
    executablePath, headless:true, args:['--no-sandbox','--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({width:1280,height:720});
    await page.setContent('<main><video controls width="640"></video><div id="ko-sub">난 어딘가에 가고 싶어</div></main>');
    await page.evaluate(()=>{
      const data={savedWords:{},userDictionary:{}};
      const change=[];
      let listener=null;
      window.__mesData=data;
      window.__mesListener=msg=>new Promise(resolve=>listener(msg,{},resolve));
      window.chrome={
        storage:{
          local:{
            get:async key=>typeof key==='string'?{[key]:data[key]}:data,
            set:async update=>{Object.assign(data,update); for(const fn of change)fn(
              Object.fromEntries(Object.entries(update).map(([key,newValue])=>[key,{newValue}])), 'local'
            );}
          },
          onChanged:{addListener:fn=>change.push(fn)}
        },
        runtime:{
          onMessage:{addListener:fn=>{listener=fn;}},
          sendMessage:async msg=>{
            if(msg.type==='dictionary:lookup') return window.__mesDictLookup(msg.word);
            return {ok:true};
          }
        }
      };
    });
    await page.exposeFunction('__mesDictLookup',word=>{
      const k=String(word).toLowerCase();
      const entry=lexicon[k];
      return {ok:true,entry:entry?{
        word:k,meaning:entry.meaning_ko,ipa:entry.ipa||'',pos:entry.pos||''
      }:null,fullDictionaryLoaded:true};
    });
    await page.addStyleTag({path:path.join(root,'extension/content.css')});
    await page.addScriptTag({path:path.join(root,'extension/lexicon.js')});
    await page.addScriptTag({path:path.join(root,'extension/content.js')});
    await page.evaluate(()=>window.__mesListener({type:'overlay:text',text:"Do you want to go somewhere?"}));
    await page.waitForSelector('#mes-caption-root.mes-visible');
    assert.equal(await page.$eval('#ko-sub',el=>el.textContent), '난 어딘가에 가고 싶어');
    assert.ok((await page.$$eval('.mes-word',nodes=>nodes.map(n=>n.textContent))).includes('somewhere'));
    await page.evaluate(()=>[...document.querySelectorAll('.mes-word')].find(n=>n.textContent==='somewhere').click());
    await page.waitForFunction(()=>document.querySelector('.mes-meaning')?.textContent.includes('어딘가'),{timeout:10000});
    await page.click('.mes-tools button:nth-child(2)');
    await page.waitForFunction(()=>window.__mesData.savedWords.somewhere?.meaning);
    assert.match(await page.$eval('.mes-meaning',el=>el.textContent),/어딘가/);
    // User-defined entry overrides bundled dictionary.
    await page.click('.mes-tools button:nth-child(3)');
    await page.evaluate(()=>chrome.storage.local.set({userDictionary:{somewhere:'내가 직접 쓴 뜻'}}));
    await page.evaluate(()=>[...document.querySelectorAll('.mes-word')].find(n=>n.textContent==='somewhere').click());
    await page.waitForFunction(()=>document.querySelector('.mes-meaning')?.textContent==='내가 직접 쓴 뜻');
    // Fullscreen host relocation on simulated Fullscreen API event.
    await page.evaluate(()=>{
      const layer=document.createElement('section'); layer.id='simulated-fullscreen';document.body.appendChild(layer);
      Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>layer});
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    assert.equal(await page.$eval('#mes-caption-root',el=>el.parentElement.id),'simulated-fullscreen');
    await page.evaluate(()=>window.__mesListener({type:'overlay:unmount'}));
    assert.equal(await page.$('#mes-caption-root'),null);
    console.log('PASS Chromium caption display, Korean preservation, click translation, saved words, user override, fullscreen relocation, unmount');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
