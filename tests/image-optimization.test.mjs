import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { isNoticeImagePath, prepareNoticeForSave } from "../lib/invitation-notice.js";

const owner="11111111-1111-4111-8111-111111111111", event="22222222-2222-4222-8222-222222222222", id="33333333-3333-4333-8333-333333333333";
test("notice save accepts JPG/WebP only for the authenticated owner and saved event", () => {
  for(const ext of ["jpg","webp"]){
    const path=`${owner}/notice/${event}/${id}.${ext}`;
    assert.equal(isNoticeImagePath(path,owner,event),true);
    assert.equal(prepareNoticeForSave({imagePath:path},{}).imagePath,path);
    assert.equal(isNoticeImagePath(path,event,event),false);
    assert.equal(isNoticeImagePath(path,owner,owner),false);
    assert.equal(isNoticeImagePath(path,owner,undefined),false);
  }
  for(const suffix of ["png","jpg.exe","webp?x=1","%77ebp","jpg/../x"])
    assert.equal(isNoticeImagePath(`${owner}/notice/${event}/${id}.${suffix}`,owner,event),false);
});

const source=(await readFile(new URL("../app/api/notice-photo/route.js",import.meta.url),"utf8")).replace(/^import .*;\r?\n/gm,"").replace("export async function POST","async function POST");
test("isolated notice HTTP handler preserves MIME/extensions, rejects mismatch, and reports WebP retry signal",async()=>{
  const uploads=[];let fail=false;
  const db={auth:{getUser:async()=>({data:{user:{id:owner}}})},from(){const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{id:event}})};return q;},storage:{from:()=>({upload:async(path,bytes,options)=>{uploads.push({path,options});return {error:fail?{message:"fixture"}:null};},getPublicUrl:path=>({data:{publicUrl:`https://fixture.test/${path}`}})})}};
  const handler=runInNewContext(source+'\nPOST',{Buffer,URL,Response,randomUUID:()=>id,createClient:()=>db,reserveUploadIfEnabled:async()=>({enabled:false}),finishReservedUpload:async()=>true,process:{env:{NEXT_PUBLIC_SUPABASE_URL:"https://fixture.test",SUPABASE_SERVICE_ROLE_KEY:"fixture"}}});
  const request=(mime,bytes)=>new Request('https://fixture.test/api/notice-photo',{method:'POST',headers:{authorization:'Bearer fixture','x-event-slug':'fixture-slug','content-type':mime},body:bytes});
  for(const [mime,bytes,ext]of [["image/jpeg",Buffer.from([255,216,255,0]),"jpg"],["image/webp",Buffer.from("RIFF0000WEBP"),"webp"]]){
    const response=await handler(request(mime,bytes));assert.equal(response.status,200);
    const result=await response.json();assert.equal(isNoticeImagePath(result.path,owner,event),true);
    assert.ok(uploads.at(-1).path.endsWith('.'+ext));assert.equal(uploads.at(-1).options.contentType,mime);
  }
  assert.equal((await handler(request('image/webp',Buffer.from([255,216,255,0])))).status,400);
  assert.equal((await handler(request('image/png',Buffer.from('png')))).status,415);
  assert.equal((await handler(request('image/jpeg',Buffer.alloc(3*1024*1024+1)))).status,413);
  fail=true;const response=await handler(request('image/webp',Buffer.from('RIFF0000WEBP')));
  assert.equal(response.status,500);assert.equal((await response.json()).error,'WEBP_UPLOAD_FAILED');
});

test("browser measures real canvas encoders without contacting Storage",{skip:process.env.TEST_IMAGE_BROWSER!=="true",timeout:90000},async()=>{
  const {chromium}=await import('playwright-core');
  const browser=await chromium.launch({executablePath:process.env.TEST_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    const page=await browser.newPage();
    const prepare=(await readFile(new URL('../lib/prepare-photo.js',import.meta.url),'utf8')).replaceAll('export ','');
    const hero=(await readFile(new URL('../lib/optimize-hero-decoration.js',import.meta.url),'utf8')).replaceAll('export ','');
    const body=(await readFile(new URL('../app/admin/templates/template-assets.js',import.meta.url),'utf8')).split('async function optimizeBodyAsset')[1].split('export default')[0];
    const sample=(await readFile(new URL('../app/admin/completed-templates/page.js',import.meta.url),'utf8')).split('async function optimizeTemplateSampleUpload')[1].split('export default')[0];
    const editor=(await readFile(new URL('../app/create/page.js',import.meta.url),'utf8')).split('  const uploadEditorPhoto =')[1].split('  const uploadBrandImage')[0];
    const results=await page.evaluate(async({prepare,hero,body,sample,editor})=>{
      const api=new Function(prepare+'\n'+hero+'\nasync function optimizeBodyAsset'+body+'\nasync function optimizeTemplateSampleUpload'+sample+'\nreturn {prepareHeroPhoto,preparePhoto,prepareKakaoSharePhoto,optimizeHeroImageWithReport,optimizeBodyAsset,optimizeTemplateSampleUpload}')();
      const urls=new Set(),create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
      URL.createObjectURL=x=>{const u=create(x);urls.add(u);return u};URL.revokeObjectURL=u=>{urls.delete(u);revoke(u)};
      const check=(x,msg)=>{if(!x)throw Error(msg)};
      async function image(file){const bitmap=await createImageBitmap(file),c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const cx=c.getContext('2d');cx.drawImage(bitmap,0,0);const result={type:file.type,name:file.name,bytes:file.size,width:bitmap.width,height:bitmap.height,alpha:cx.getImageData(5,5,1,1).data[3]};bitmap.close();return result}
      const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1800;const ctx=canvas.getContext('2d'),data=ctx.createImageData(2400,1800);let seed=17;
      for(let i=0;i<data.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)|0;data.data[i]=seed>>>24;data.data[i+1]=seed>>>16;data.data[i+2]=seed>>>8;data.data[i+3]=255}ctx.putImageData(data,0,0);ctx.clearRect(0,0,200,200);
      const rows=[];
      for(const mime of ['image/jpeg','image/png','image/webp']){
        const original=new File([await new Promise(r=>canvas.toBlob(r,mime,.9))],'fixture.'+mime.split('/')[1],{type:mime});
        const input=await image(original),user=await api.prepareHeroPhoto(original),sample=await api.optimizeTemplateSampleUpload(original);
        const design=(await api.optimizeHeroImageWithReport(original,{maxSide:Infinity})).file;
        const output=await image(design);check(output.width===2400&&output.height===1800,'HERO design dimensions');
        if(mime==='image/png')check(output.alpha===0,'HERO alpha');
        check(!output.name.endsWith('.png.webp'),'double extension');
        for(const type of ['background','hero_frame','texture','screen_effect']){const result=await image(await api.optimizeBodyAsset(original,type));check(result.width===2400&&result.height===1800,'body design dimensions '+type);if(mime==='image/png')check(result.alpha===0,'body alpha')}
        const small=await image(user.photo);check(small.width<=1400&&small.height<=1400,'user size');check(user.photo.type===(user.format==='webp'?'image/webp':'image/jpeg'),'user MIME');
        const sampled=await image(sample);check(sampled.width<=1200||sample===original,'sample resize or safe original fallback');
        rows.push({input,user:small,design:output,sample:sampled});
      }
      canvas.width=1200;canvas.height=800;ctx.fillStyle='#123456';ctx.fillRect(0,0,1200,800);const normal=new File([await new Promise(r=>canvas.toBlob(r,'image/jpeg'))],'normal.jpg',{type:'image/jpeg'});
      const n=await image((await api.prepareHeroPhoto(normal)).photo);check(n.width===1200&&n.height===800,'no upscale');
      const share=await image(await api.prepareKakaoSharePhoto(normal));check(share.width===1200&&share.height===600,'Kakao ratio');
      canvas.width=32;canvas.height=32;const tiny=new File([await new Promise(r=>canvas.toBlob(r,'image/png'))],'tiny.png',{type:'image/png'});check((await api.optimizeHeroImageWithReport(tiny)).file===tiny,'small original');
      let rejected=false;try{await api.preparePhoto(new File([new Uint8Array(15*1024*1024+1)],'huge.png',{type:'image/png'}))}catch{rejected=true}check(rejected,'input limit');
      const calls=[];const upload=new Function('prepareHeroPhoto','fetch','uploadEventSlug','return ('+editor.trim().replace(/;$/,'')+')')(async()=>({photo:new Blob(['w'],{type:'image/webp'}),jpeg:new Blob(['j'],{type:'image/jpeg'}),format:'webp'}),async(_,o)=>{calls.push(o.headers['Content-Type']);return calls.length===1?Response.json({error:'WEBP_UPLOAD_FAILED'},{status:500}):Response.json({url:'https://fixture.test/photo.jpg'})},async()=>'fixture');
      check(await upload(normal,{access_token:'fixture'})==='https://fixture.test/photo.jpg','JPEG retry');check(calls.join(',')==='image/webp,image/jpeg','retry MIME');check(urls.size===0,'object URL cleanup');
      return {rows,normal:n,kakao:share,retry:calls,objectURLs:urls.size};
    },{prepare,hero,body,sample,editor});
    console.log('IMAGE_METRICS '+JSON.stringify(results));
  }finally{await browser.close()}
});
