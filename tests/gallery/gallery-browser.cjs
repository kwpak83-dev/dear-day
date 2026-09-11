const { chromium } = require('playwright');
const sharp = require('sharp');
const http = require('node:http');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
(async()=>{
  const image = await sharp({create:{width:2400,height:1800,channels:3,background:'#b88979'}}).png().toBuffer();
  const second = await sharp({create:{width:1800,height:2400,channels:3,background:'#718c75'}}).png().toBuffer();
  const third = await sharp({create:{width:1800,height:2400,channels:3,background:'#8c759c'}}).png().toBuffer();
  let photos=[], reservations=[], uploads=0, reserves=0, failNext=false, failReorder=false;
  const owner=randomUUID(), event=randomUUID();
  const asPhoto=row=>({id:row.id,hash:row.hash,url:`http://127.0.0.1:4319/storage/v1/object/public/invitation-photos/${row.id}.jpg`});
  const settings={groom:'경원',bride:'보람',date:'2026-10-17',time:'12:30',venue:'더가든 웨딩홀',message:'소중한 순간을 함께해 주세요.',coverPhotoUrl:'http://127.0.0.1:4319/cover.jpg'};
  const server=http.createServer((req,res)=>{
    res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json');
    if(req.url.includes('/rest/v1/events'))return res.end(JSON.stringify([{id:event,settings,starts_at:'2026-10-17T03:30:00Z',title:'test'}]));
    if(req.url.includes('/rest/v1/event_media'))return res.end(JSON.stringify(photos.map(p=>({id:p.id,storage_path:p.id+'.jpg'}))));
    if(req.url.includes('/auth/v1/'))return res.end(JSON.stringify({id:owner}));
    res.setHeader('Content-Type','image/png');res.end(image);
  });
  await new Promise(resolve=>server.listen(4319,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({headless:true,channel:'msedge'});
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await context.addInitScript(({owner,settings})=>{
      const payload=btoa(JSON.stringify({sub:owner,exp:4102444800,role:'authenticated'}));
      localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:'e30.'+payload+'.test',refresh_token:'test-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id:owner}}));
      localStorage.setItem('dear-day-draft',JSON.stringify(settings));
      localStorage.setItem('dear-day-event-slug','test-gallery');
    },{owner,settings});
    const page=await context.newPage();
    const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
    await page.route('**/api/events**',route=>route.fulfill({json:{event:{slug:'test-gallery',settings}}}));
    await page.route('**/api/gallery?**',async route=>{
      const req=route.request(),url=new URL(req.url()),method=req.method();
      const snapshot=()=>({photos,pendingCount:reservations.filter(r=>r.state!=='ready').length,cleanupPending:false});
      if(method==='GET')return route.fulfill({json:snapshot()});
      if(method==='POST'){
        reserves++;reservations=req.postDataJSON().hashes.map(hash=>({id:randomUUID(),hash,state:'pending'}));
        return route.fulfill({json:{reservations}});
      }
      if(method==='PUT'){
        uploads++;const row=reservations.find(r=>r.id===url.searchParams.get('id'));
        const metadata=await sharp(req.postDataBuffer()).metadata();
        assert.equal(metadata.format,'jpeg');assert.ok(Math.max(metadata.width,metadata.height)<=1600);
        if(failNext){failNext=false;return route.fulfill({status:500,json:{error:'테스트 업로드 실패'}});}
        row.state='ready';const photo=asPhoto(row);photos.push(photo);return route.fulfill({json:{photo}});
      }
      if(method==='DELETE'){photos=photos.filter(p=>p.id!==url.searchParams.get('id'));return route.fulfill({json:snapshot()});}
      if(method==='PATCH'){
        if(failReorder){failReorder=false;return route.fulfill({status:409,json:{error:'다른 화면에서 갤러리가 변경됐어요.'}});}
        photos=req.postDataJSON().ids.map(id=>photos.find(p=>p.id===id));return route.fulfill({json:snapshot()});
      }
    });
    await page.goto('http://localhost:4318/create?slug=test-gallery');
    const input=page.getByLabel('갤러리 사진 추가');
    await input.waitFor();await page.waitForFunction(()=>!document.querySelector('input[multiple]')?.disabled);
    const fixture=(name,buffer=image)=>({name,mimeType:'image/png',buffer});
    await input.setInputFiles(Array.from({length:21},(_,i)=>fixture(i+'.png')));
    await page.getByText(/갤러리에는 최대 20장까지/).waitFor();assert.equal(reserves,0);assert.equal(uploads,0);
    await input.setInputFiles([fixture('first.png'),fixture('second.png',second)]);
    await page.getByText('2장 저장 완료',{exact:true}).waitFor();assert.equal(photos.length,2);
    assert.equal(await page.locator('.photo-selection img').count(),1);
    await input.setInputFiles([fixture('first-again.png')]);
    await page.getByText('0장 저장 완료 · 중복 1장 제외',{exact:true}).waitFor();assert.equal(uploads,2);
    const original=photos.map(p=>p.id);
    await page.getByRole('button',{name:'2번 사진 앞으로',exact:true}).click();
    await page.getByText('사진 순서를 저장했어요.',{exact:true}).waitFor();assert.equal(photos[0].id,original[1]);
    await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.gallery-tile').length===2);
    assert.equal(await page.locator('.gallery-tile').first().getAttribute('data-gallery-id'),original[1]);
    const handle=page.getByRole('button',{name:'1번 사진 순서 이동 손잡이',exact:true});await handle.scrollIntoViewIfNeeded();
    const a=await handle.boundingBox(),b=await page.locator('.gallery-tile').nth(1).boundingBox();
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width/2,y:a.y+a.height/2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(id=>document.querySelector('.gallery-tile')?.dataset.galleryId===id,original[0]);
    failReorder=true;await page.getByRole('button',{name:'2번 사진 앞으로',exact:true}).click();
    await page.getByText('다른 화면에서 갤러리가 변경됐어요.',{exact:true}).waitFor();assert.equal(photos[0].id,original[0]);
    await page.getByRole('button',{name:'2번 사진 삭제',exact:true}).click();
    await page.getByText('사진을 삭제했어요.',{exact:true}).waitFor();assert.equal(photos.length,1);
    failNext=true;await input.setInputFiles([fixture('failed.png',second),fixture('third.png',third)]);
    await page.getByText('1장 저장 완료 · 1장 실패',{exact:true}).waitFor();await page.getByText('failed.png: 테스트 업로드 실패',{exact:true}).waitFor();assert.equal(photos.length,2);
    fs.mkdirSync(__dirname+'/screenshots',{recursive:true});
    await page.locator('.gallery-editor').screenshot({path:__dirname+'/screenshots/editor-mobile.png'});
    await page.goto('http://localhost:4318/invite/test-gallery');
    await page.getByRole('button',{name:'1번 사진 크게 보기',exact:true}).waitFor();
    assert.equal(await page.locator('.public-gallery-grid img[loading="lazy"]').count(),2);
    const cols=await page.locator('.public-gallery-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);assert.equal(cols,2);
    assert.equal(await page.locator('.public-photo img').count(),1);
    await page.getByRole('button',{name:'1번 사진 크게 보기',exact:true}).click();
    await page.locator('dialog[open]').waitFor();
    await page.getByRole('button',{name:'다음 사진',exact:true}).click();
    await page.locator('.gallery-viewer-bar').getByText('2 / 2',{exact:true}).waitFor();
    await page.screenshot({path:__dirname+'/screenshots/lightbox-mobile.png'});
    await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
    const focus=await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'));assert.equal(focus,'1번 사진 크게 보기');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
    assert.deepEqual(pageErrors,[]);
    console.log('PASS mobile browser: whole-selection limit, multi-upload/optimization, dedup, reload/order, touch drag, conflict rollback, deletion, partial failure, cover unchanged, public grid/lazy loading, lightbox navigation/Escape/focus, no overflow/errors. Supabase/API are mocked.');
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
