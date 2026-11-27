// node render.js <workdir> <comma-separated scene indexes> | node render.js <workdir> test '[[scene,t],...]'
const puppeteer = require('puppeteer-core'); const fs = require('fs'); const path = require('path'); const {spawn} = require('child_process');
const WD = path.resolve(process.argv[2]); const J = JSON.parse(fs.readFileSync(`${WD}/timeline.json`)); const T = J.scenes;
const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>fs.existsSync(p));
(async()=>{
  const mode = process.argv[3];
  const browser = await puppeteer.launch({executablePath:CHROME, args:['--no-sandbox','--font-render-hinting=none','--disable-gpu'], headless:'new'});
  const page = await browser.newPage(); await page.setViewport({width:1920,height:1080,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(t=>{window.T=t}, J);
  await page.goto('file://'+path.join(__dirname,'page.html')); await page.evaluate(()=>document.fonts.ready);
  if (mode==='test'){
    fs.mkdirSync(`${WD}/test`,{recursive:true});
    for (const [i,t] of JSON.parse(process.argv[4])){ await page.evaluate((i,t)=>window.draw(i,t), i, t); await page.screenshot({path:`${WD}/test/s${i}_${t}.jpg`, type:'jpeg', quality:92}); }
  } else {
    fs.mkdirSync(`${WD}/scenes`,{recursive:true});
    for (const i of mode.split(',').map(Number)){
      const s=T[i]; const f0=Math.round(s.start*30), f1=Math.round((s.start+s.dur)*30), n=f1-f0;
      const tmp=`${WD}/scenes/s${i}.tmp.mp4`, fin=`${WD}/scenes/s${i}.mp4`;
      const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-c:v','libx264','-crf','18','-preset','veryfast','-pix_fmt','yuv420p','-r','30',tmp],{stdio:['pipe','inherit','inherit']});
      const done = new Promise(r=>ff.on('close',r));
      for (let f=0;f<n;f++){
        const t = Math.min(s.dur, (f0+f)/30 - s.start);
        await page.evaluate((i,t)=>window.draw(i,t), i, t);
        const buf = await page.screenshot({type:'jpeg', quality:90});
        if (!ff.stdin.write(buf)) await new Promise(r=>ff.stdin.once('drain',r));
      }
      ff.stdin.end(); const code = await done; if (code===0) fs.renameSync(tmp,fin); else { console.log('ffmpeg fail',i); process.exit(1); }
      console.log('scene',i,'frames',n);
    }
  }
  await browser.close();
})();
