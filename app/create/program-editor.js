"use client";
import { useEffect, useRef, useState } from "react";
import InvitationProgram from "../../components/invitation/invitation-program";
import ProgramIcon, { PROGRAM_ICONS, PROGRAM_ICON_CATEGORIES } from "../../components/invitation/program-icons";
import { normalizeProgram, PROGRAM_LIMITS, PROGRAM_DEFAULTS } from "../../lib/invitation-program";

export default function ProgramEditor({ value, eventKind, onChange }) {
  const program = normalizeProgram(value);
  const [pickerId,setPickerId] = useState(null);
  const [category,setCategory] = useState("all");
  const [previewOpen,setPreviewOpen] = useState(false);
  const editorRef = useRef(null);
  const resizeTitle = node => { if (!node) return; node.style.height = "auto"; node.style.height = `${node.scrollHeight}px`; };
  useEffect(() => { editorRef.current?.querySelectorAll(".dd-program-title-autosize").forEach(resizeTitle); }, [program.items]);
  const pickerRef = useRef(null);
  const openerRef = useRef(null);
  useEffect(() => { if(!pickerId) return; const escape=e=>{if(e.key==="Escape") setPickerId(null)}; document.addEventListener("keydown",escape); pickerRef.current?.focus(); return ()=>document.removeEventListener("keydown",escape); },[pickerId]);
  useEffect(() => { if (!previewOpen) return; const onKey = e => { if (e.key === "Escape") setPreviewOpen(false); }; document.addEventListener("keydown",onKey); return () => document.removeEventListener("keydown",onKey); },[previewOpen]);
  const closePicker=()=>{setPickerId(null);requestAnimationFrame(()=>openerRef.current?.focus());};
  const commit = next => {
    const normalized = normalizeProgram(next);
    if (JSON.stringify(normalized) !== JSON.stringify(program)) onChange(normalized);
  };
  const patch = values => commit({ ...program, ...values });
  const updateItem = (id, values) => patch({ items: program.items.map(item => item.id === id ? { ...item, ...values } : item) });
  return <div className="dd-program-editor" ref={editorRef}>
    <div className="form-section dd-program-editor-fields">
        <label className="form-field"><span>제목</span><input value={program.title} maxLength={PROGRAM_LIMITS.title} placeholder={PROGRAM_DEFAULTS[eventKind]?.title || "행사 일정"} onChange={event => patch({ title: event.target.value })} /></label>
        <label className="dd-transport-guide-toggle"><input type="checkbox" checked={program.displayMode === "time"} onChange={event => patch({ displayMode: event.target.checked ? "time" : "number" })} /> 시간 입력 사용</label>
        <p>최대 {PROGRAM_LIMITS.items}개까지 등록할 수 있어요. 시간 입력을 꺼도 기존 시간과 식순 내용은 유지됩니다.</p>
        <div className="dd-program-style-chooser"><strong>식순 디자인</strong><div className="dd-program-style-options">{[["editorial","감성 타임라인형","중앙 아이콘 타임라인"],["card","카드형","기존 리스트 디자인"]].map(([id,label,desc])=><button key={id} type="button" aria-pressed={program.style===id} className={program.style===id?"is-selected":""} onClick={()=>patch({style:id})}><span className="dd-program-style-symbol" aria-hidden="true">{id==="card"?"▤":"♧"}</span><strong>{label}</strong></button>)}</div><button type="button" className="dd-program-preview-button" style={{width:"100%",marginTop:10,minHeight:32,padding:"6px 10px",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontSize:12,lineHeight:"16px",border:0,borderRadius:9,background:"#555",color:"#fff",cursor:"pointer"}} onClick={()=>setPreviewOpen(true)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/></svg><span>식순 미리보기</span></button></div>
        {program.items.map((item, index) => <div key={item.id} className="dd-program-editor-item dd-program-editor-item--compact">
          <div className="dd-program-item-leading">
            {program.style === "editorial" && <button type="button" className="dd-program-icon-trigger" aria-label={`항목 ${index+1} 클립아트 선택`} onClick={event=>{openerRef.current=event.currentTarget;setCategory("all");setPickerId(item.id)}}>{item.iconId?<ProgramIcon id={item.iconId} size={38}/>:<span>＋<small>클립아트</small></span>}</button>}
            <div className="dd-program-move-controls">
              <button type="button" disabled={index===0} aria-label={`항목 ${index+1} 위로 이동`} onClick={()=>{const items=[...program.items];[items[index-1],items[index]]=[items[index],items[index-1]];patch({items});}}>↑</button>
              <button type="button" disabled={index===program.items.length-1} aria-label={`항목 ${index+1} 아래로 이동`} onClick={()=>{const items=[...program.items];[items[index],items[index+1]]=[items[index+1],items[index]];patch({items});}}>↓</button>
            </div>
          </div>
          <div className={`dd-program-editor-item-fields${program.displayMode === "time" ? " dd-program-editor-item-fields--time" : ""}`}>
            <div className="dd-program-item-heading"><span>항목 {index + 1} 제목</span><button type="button" className="dd-program-delete-button" aria-label={`항목 ${index + 1} 삭제`} onClick={() => patch({ items: program.items.filter(row => row.id !== item.id) })}>삭제</button></div>
            <label className="form-field"><textarea className="dd-program-title-autosize" rows={1} style={{resize:"none",overflow:"hidden",minHeight:0}} value={item.title} maxLength={PROGRAM_LIMITS.itemTitle} onInput={event => resizeTitle(event.currentTarget)} onChange={event => updateItem(item.id, { title: event.target.value })} aria-label={`항목 ${index+1} 제목`} /></label>
            <label className="form-field"><span>항목 {index + 1} 설명 (선택)</span><textarea rows={2} value={item.description || ""} maxLength={PROGRAM_LIMITS.itemDescription} placeholder="제목 아래에 표시할 설명을 입력해 주세요." onChange={event => updateItem(item.id, { description: event.target.value })} aria-label={`항목 ${index+1} 설명`} style={{resize:"vertical"}} /></label>
            {program.displayMode === "time" && <label className="form-field"><span>항목 {index + 1} 시간</span><input type="time" value={item.time} onChange={event => updateItem(item.id, { time: event.target.value })} /></label>}
          </div>
        </div>)}
        <button type="button" className="dd-program-add-button" disabled={program.items.length >= PROGRAM_LIMITS.items} onClick={() => patch({ items: [...program.items, { id: globalThis.crypto?.randomUUID?.() || `program-${Date.now()}-${Math.random().toString(36).slice(2)}`, title: "", time: "" }] })}>+ 항목 추가</button>
    </div>
    {previewOpen && <div role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setPreviewOpen(false)}} style={{position:"fixed",inset:0,zIndex:10000,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}><section role="dialog" aria-modal="true" aria-label="식순 미리보기" style={{background:"#fff",width:"min(100%,430px)",maxHeight:"min(90dvh,800px)",borderRadius:22,display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 16px 50px rgba(0,0,0,.22)"}}><header style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:"1px solid #eee"}}><strong>식순 미리보기</strong><button type="button" onClick={()=>setPreviewOpen(false)} aria-label="미리보기 닫기" style={{border:0,background:"transparent",fontSize:26,cursor:"pointer"}}>×</button></header><div className={`dd-program-preview-content invitation-bottom-sheet--program${program.style === "editorial" ? " invitation-bottom-sheet--program-editorial" : ""}`} style={{overflowY:"auto",overscrollBehavior:"contain",padding:0}}>{program.items.some(item=>item.title.trim())?<InvitationProgram program={{...program,enabled:true}} eventKind={eventKind}/>:<p style={{padding:28,textAlign:"center",color:"#777"}}>식순 항목을 입력하면 미리보기가 표시됩니다.</p>}</div></section></div>}
    {pickerId && <div className="dd-program-icon-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)closePicker()}}><section className="dd-program-icon-picker" role="dialog" aria-modal="true" aria-label="클립아트 선택" tabIndex={-1} ref={pickerRef}><header><strong>클립아트 선택</strong><button type="button" onClick={closePicker} aria-label="닫기">×</button></header><div className="dd-program-icon-categories">{PROGRAM_ICON_CATEGORIES.map(cat=><button type="button" key={cat.id} aria-pressed={category===cat.id} onClick={()=>setCategory(cat.id)}>{cat.label}</button>)}</div><div className="dd-program-icon-grid"><button type="button" onClick={()=>{updateItem(pickerId,{iconId:""});closePicker()}}><span className="dd-program-no-icon">없음</span><small>아이콘 없음</small></button>{PROGRAM_ICONS.filter(icon=>category==="all"||icon.category===category).map(icon=><button type="button" key={icon.id} aria-pressed={program.items.find(item=>item.id===pickerId)?.iconId===icon.id} onClick={()=>{updateItem(pickerId,{iconId:icon.id});closePicker()}}><ProgramIcon id={icon.id} size={37}/><small>{icon.label}</small></button>)}</div></section></div>}
  </div>;
}
