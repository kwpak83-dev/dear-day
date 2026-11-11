"use client";
import { useEffect, useState } from "react";

const fonts=[{name:"감성 손글씨",family:"cursive"},{name:"명조",family:"Georgia, serif"},{name:"깔끔한 고딕",family:"sans-serif"}];
export default function LandingIntroEditorDemo(){
 const [message,setMessage]=useState("우리의 소중한 날에\\n당신을 초대합니다.".replace("\\n","\n"));
 const [font,setFont]=useState(0);
 const [size,setSize]=useState(28);
 const [color,setColor]=useState("#55463c");
 const [background,setBackground]=useState("#f9f5ef");
 const [playing,setPlaying]=useState(false);
 const [replay,setReplay]=useState(0);
 useEffect(()=>{if(!playing)return;const timer=setTimeout(()=>setPlaying(false),6500);return()=>clearTimeout(timer)},[playing,replay]);
 return <div className="dd-landing-intro-editor">
  <div className="dd-landing-intro-editor-title"><strong>인트로 레터링 편집</strong><span>LIVE EDITOR</span></div>
  <label className="dd-landing-intro-field">레터링 문구<textarea rows={3} maxLength={80} value={message} onChange={e=>{setMessage(e.target.value);setPlaying(false)}} placeholder="초대 문구를 입력하세요"/></label>
  <div className="dd-landing-intro-settings">
   <label>글꼴<select value={font} onChange={e=>setFont(Number(e.target.value))}>{fonts.map((f,i)=><option key={f.name} value={i}>{f.name}</option>)}</select></label>
   <label>글자 크기 <span>{size}px</span><input type="range" min="16" max="48" value={size} onChange={e=>setSize(Number(e.target.value))}/></label>
  </div>
  <div className="dd-landing-intro-colors"><label>글자 색상 <input aria-label="글자 색상" type="color" value={color} onChange={e=>setColor(e.target.value)}/></label><label>배경 색상 <input aria-label="배경 색상" type="color" value={background} onChange={e=>setBackground(e.target.value)}/></label></div>
  <div className="dd-landing-intro-stage" style={{backgroundColor:background}}>
   <div key={replay} className={playing?"dd-landing-intro-writing":""} style={{color,fontFamily:fonts[font].family,fontSize:size,whiteSpace:"pre-wrap"}}>{message||"초대 문구를 입력해 주세요."}</div>
  </div>
  <button className="dd-landing-intro-play" type="button" onClick={()=>{setReplay(v=>v+1);setPlaying(true)}}>▶ 애니메이션 미리보기</button>
  <p className="dd-landing-intro-hint">문구와 스타일을 바꾼 뒤 미리보기를 눌러보세요</p>
 </div>;
}
