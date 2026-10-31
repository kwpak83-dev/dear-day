"use client";
import { useState } from "react";
import { normalizeCoupleIntro, normalizeLoveStory } from "../../../lib/wedding-story";

function HashtagInput({hashtags,onChange}) {
 const [draft,setDraft]=useState(()=>(hashtags||[]).join(", "));
 const update=(text)=>{setDraft(text);onChange(text.split(",").slice(0,8).map(x=>x.trim()).filter(Boolean));};
 return <input style={input} value={draft} placeholder="예: INTJ, 새침, 먹순이" onChange={e=>update(e.target.value)} onBlur={()=>setDraft((hashtags||[]).join(", "))}/>;
}
const input={width:"100%",boxSizing:"border-box",padding:"8px",border:"1px solid #ddd",borderRadius:7};
const block={padding:12,border:"1px solid #e7ddd7",borderRadius:9,display:"grid",gap:9};
export default function WeddingStorySampleEditor({value,onChange,onUpload,disabled=false,shared=false}){
 const [uploading,setUploading]=useState("");
 const couple=normalizeCoupleIntro(value?.couple_intro);
 const story=normalizeLoveStory(value?.love_story);
 const setCouple=patch=>onChange("couple_intro",{...couple,...patch});
 const setPerson=(role,patch)=>setCouple({[role]:{...couple[role],...patch}});
 const setStory=patch=>onChange("love_story",{...story,...patch});
 const setItems=items=>setStory({items});
 const updateItem=(id,patch)=>setItems(story.items.map(item=>item.id===id?{...item,...patch}:item));
 const upload=async(key,file,apply)=>{if(!file)return;setUploading(key);try{const url=await onUpload(file);apply(url);}finally{setUploading("");}};
 return <div style={{display:"grid",gap:14}}>
  {!shared&&<small>설정하지 않은 항목은 공통 샘플을 상속합니다. 개별 설정을 시작하면 해당 섹션 전체를 덮어씁니다.</small>}
  <section style={block}><b>신랑·신부 소개 샘플</b>
   {!shared&&value?.couple_intro!==undefined&&<button type="button" onClick={()=>onChange("couple_intro",undefined)}>공통 샘플 상속으로 되돌리기</button>}
   <label><input type="checkbox" checked={couple.enabled} onChange={e=>setCouple({enabled:e.target.checked})}/> 사용</label>
   {couple.enabled&&<><label>제목<input style={input} maxLength={80} value={couple.title} onChange={e=>setCouple({title:e.target.value})}/></label><label>부제목<input style={input} maxLength={100} value={couple.subtitle} onChange={e=>setCouple({subtitle:e.target.value})}/></label>
   {["groom","bride"].map(role=><div key={role} style={block}><b>{role==="groom"?"신랑":"신부"}</b>{couple[role].photoUrl&&<div style={{width:150,aspectRatio:"3/4",overflow:"hidden",borderRadius:6,background:"#eee"}}><img src={couple[role].photoUrl} alt={`${role==="groom"?"신랑":"신부"} 사진 위치 미리보기`} style={{display:"block",width:"100%",height:"100%",objectFit:"cover",objectPosition:`${couple[role].photoFocusX}% ${couple[role].photoFocusY}%`,transform:`scale(${couple[role].photoZoom/100})`,transformOrigin:`${couple[role].photoFocusX}% ${couple[role].photoFocusY}%`}}/></div>}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled||!!uploading} onChange={e=>{const f=e.target.files?.[0];e.target.value="";void upload(role,f,url=>setPerson(role,{photoUrl:url}));}}/>{couple[role].photoUrl&&<button type="button" onClick={()=>setPerson(role,{photoUrl:""})}>사진 제거</button>}<label>소개<textarea style={input} maxLength={160} value={couple[role].intro} onChange={e=>setPerson(role,{intro:e.target.value})}/></label><label>해시태그<HashtagInput key={role} hashtags={couple[role].hashtags} onChange={hashtags=>setPerson(role,{hashtags})}/></label><label>확대 {couple[role].photoZoom}%<input type="range" min="100" max="200" value={couple[role].photoZoom} onChange={e=>setPerson(role,{photoZoom:Number(e.target.value)})}/></label><label>좌우<input type="range" min="0" max="100" value={couple[role].photoFocusX} onChange={e=>setPerson(role,{photoFocusX:Number(e.target.value)})}/></label><label>상하<input type="range" min="0" max="100" value={couple[role].photoFocusY} onChange={e=>setPerson(role,{photoFocusY:Number(e.target.value)})}/></label></div>)}</>}
  </section>
  <section style={block}><b>우리의 이야기 샘플</b>
   {!shared&&value?.love_story!==undefined&&<button type="button" onClick={()=>onChange("love_story",undefined)}>공통 샘플 상속으로 되돌리기</button>}
   <label><input type="checkbox" checked={story.enabled} onChange={e=>setStory({enabled:e.target.checked})}/> 사용</label>
   {story.enabled&&<><label>제목<input style={input} maxLength={80} value={story.title} onChange={e=>setStory({title:e.target.value})}/></label>
   {story.items.map((item,index)=><div key={item.id} style={block}><b>이야기 {index+1}</b><div style={{display:"flex",gap:8}}><button type="button" disabled={index===0} onClick={()=>{const a=[...story.items];[a[index-1],a[index]]=[a[index],a[index-1]];setItems(a);}}>↑</button><button type="button" disabled={index===story.items.length-1} onClick={()=>{const a=[...story.items];[a[index+1],a[index]]=[a[index],a[index+1]];setItems(a);}}>↓</button><button type="button" onClick={()=>setItems(story.items.filter(x=>x.id!==item.id))}>삭제</button></div><label>날짜<input style={input} maxLength={40} value={item.date} onChange={e=>updateItem(item.id,{date:e.target.value})}/></label><label>제목<input style={input} maxLength={50} value={item.title} onChange={e=>updateItem(item.id,{title:e.target.value})}/></label><label>설명<textarea style={input} maxLength={200} value={item.description} onChange={e=>updateItem(item.id,{description:e.target.value})}/></label>{item.photoUrl&&<img src={item.photoUrl} alt="" style={{width:100,borderRadius:6}}/>}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled||!!uploading} onChange={e=>{const f=e.target.files?.[0];e.target.value="";void upload(item.id,f,url=>updateItem(item.id,{photoUrl:url}));}}/>{item.photoUrl&&<button type="button" onClick={()=>updateItem(item.id,{photoUrl:""})}>사진 제거</button>}</div>)}
   {story.items.length<10&&<button type="button" onClick={()=>setItems([...story.items,{id:crypto.randomUUID(),photoUrl:"",date:"",title:"",description:""}])}>+ 이야기 추가</button>}</>}
  </section>
 </div>;
}
