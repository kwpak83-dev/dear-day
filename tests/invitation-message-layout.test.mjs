import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { HERO_FONTS } from '../lib/hero-fonts.js';
import { invitationPreviewWidth } from '../lib/invitation-preview-layout.mjs';

test('preview layout follows public responsive width, independently of visual scaling', () => {
  for (const width of [360,390,430,540,800]) {
    assert.equal(invitationPreviewWidth(width), Math.min(width,540));
  }
});

test('active body themes retain message CSS and wrapping across preview wrappers', {
  skip: !process.env.TEST_MESSAGE_LAYOUT_URL || !process.env.TEST_MESSAGE_TEMPLATE_CONFIGS, timeout: 90000,
}, async () => {
  const target=new URL(process.env.TEST_MESSAGE_LAYOUT_URL);
  assert.ok(['localhost','127.0.0.1'].includes(target.hostname));
  const themes=JSON.parse(await readFile(process.env.TEST_MESSAGE_TEMPLATE_CONFIGS,'utf8')).map(t=>({...t,fontStack:HERO_FONTS.find(f=>f.id===t.config?.typography?.body?.fontFamily)?.family||'Arial,sans-serif'}));
  assert.ok(themes.length>0);
  const {chromium}=await import('playwright-core');
  const browser=await chromium.launch({executablePath:process.env.TEST_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page=await browser.newPage();
    await page.route('**/*',r=>['image','media'].includes(r.request().resourceType())?r.abort():r.continue());
    assert.equal((await page.goto(target.href,{waitUntil:'domcontentloaded'})).status(),200);
    for(const width of [360,390,430]) {
      await page.setViewportSize({width,height:900});
      const result=await page.evaluate(({width,themes})=>{
        const results=[];
        for(const theme of themes) for(const changed of [false,true]) {
          const kind='classic',configured=true;
          const body=theme.config?.typography?.body||{};
          const area=theme.config?.safeArea?.sections?.invitation||{};
          const host=document.createElement('div');host.style.position='absolute';host.style.top='0';document.body.append(host);
          const text='소중한 분들을 모시고 함께 걸어가려 합니다.\n우리의 새로운 시작을 축복해 주세요.';
          const style=`--dd-body-font:${theme.fontStack};--dd-body-size:${changed?21:body.fontSize||16}px;--dd-body-weight:${body.fontWeight||400};--dd-body-line-height:${changed?1.9:body.lineHeight||1.7};--dd-body-letter-spacing:${changed?1.1:body.letterSpacing||0}px;--dd-body-align:${body.textAlign||'center'};--dd-message-max-width:${changed?320:area.messageWidth||theme.config?.safeArea?.messageWidth||280}px;--dd-section-invitation-top:24px;--dd-section-invitation-bottom:24px;--dd-section-invitation-left:${area.enabled?area.left:0}px;--dd-section-invitation-right:${area.enabled?area.right:0}px;`;
          const article=`<article class="invitation-template ${kind}-001 dd-event-${theme.event_kind} ${configured?'dd-template-typography dd-template-section-safe-area dd-safe-enabled-invitation':''}" style="${style}width:${width}px"><section class="${kind}-message"><blockquote>${text}</blockquote></section></article>`;
          for(const mode of ['public','full','message']) {
            const box=document.createElement('div');
            box.className=mode==='public'?'full-invitation-renderer':'create-page';
            box.innerHTML=mode==='public'?article:mode==='full'?`<div class="dd-editor-full-preview-canvas full-invitation-renderer" style="--dd-template-preview-layout-width:${width}px;width:${width}px;transform:scale(.65);transform-origin:top left"><div class="full-preview-document">${article}</div></div>`:`<div class="dd-message-preview-canvas full-invitation-renderer" style="--dd-message-preview-layout-width:${width}px;width:${width}px;transform:scale(.65);transform-origin:top left">${article}</div>`;
            host.append(box);
          }
          const values=[...host.querySelectorAll('blockquote')].map(e=>{
            const s=getComputedStyle(e),range=document.createRange(),node=e.firstChild,lines=[];
            for(let i=0;i<node.length;i++){range.setStart(node,i);range.setEnd(node,i+1);const y=Math.round(range.getBoundingClientRect().top);let line=lines.find(l=>Math.abs(l.y-y)<2);if(!line){line={y,text:''};lines.push(line)}line.text+=node.textContent[i]}
            return {style:Object.fromEntries(['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textAlign','whiteSpace','wordBreak','overflowWrap','width','maxWidth','paddingLeft','paddingRight'].map(k=>[k,s[k]])),lines:lines.map(l=>l.text),display:getComputedStyle(e.parentElement).display};
          });
          results.push({kind:theme.name,configured,values});host.remove();
        }
        return results;
      },{width,themes});
      for(const {kind,configured,values} of result) {
        assert.notEqual(values[2].display,'none',`${kind} floating preview must be visible`);
        assert.deepEqual(values[1],values[0],`${width} ${kind} configured=${configured} full`);
        assert.deepEqual(values[2],values[0],`${width} ${kind} configured=${configured} message`);
      }
    }
  } finally {await browser.close();}
});
