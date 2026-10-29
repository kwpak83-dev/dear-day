"use client";
import { useEffect, useRef, useState } from "react";
import ProgramIcon, { PROGRAM_ICONS, PROGRAM_ICON_CATEGORIES } from "../../components/invitation/program-icons";
import { normalizeProgram, PROGRAM_LIMITS, PROGRAM_DEFAULTS } from "../../lib/invitation-program";

export default function ProgramEditor({ value, eventKind, onChange }) {
  const program = normalizeProgram(value);
  const [pickerId,setPickerId] = useState(null);
  const [category,setCategory] = useState("all");
  const pickerRef = useRef(null);
  const openerRef = useRef(null);
  useEffect(() => { if(!pickerId) return; const escape=e=>{if(e.key==="Escape") setPickerId(null)}; document.addEventListener("keydown",escape); pickerRef.current?.focus(); return ()=>document.removeEventListener("keydown",escape); },[pickerId]);
  const closePicker=()=>{setPickerId(null);requestAnimationFrame(()=>openerRef.current?.focus());};
  const commit = next => {
    const normalized = normalizeProgram(next);
    if (JSON.stringify(normalized) !== JSON.stringify(program)) onChange(normalized);
  };
  const patch = values => commit({ ...program, ...values });
  const updateItem = (id, values) => patch({ items: program.items.map(item => item.id === id ? { ...item, ...values } : item) });
  return <div className="dd-program-editor">
    <div className="form-section dd-program-editor-fields">
        <label className="form-field"><span>제목</span><input value={program.title} maxLength={PROGRAM_LIMITS.title} placeholder={PROGRAM_DEFAULTS[eventKind]?.title || "행사 일정"} onChange={event => patch({ title: event.target.value })} /></label>
        <label className="dd-transport-guide-toggle"><input type="checkbox" checked={program.displayMode === "time"} onChange={event => patch({ displayMode: event.target.checked ? "time" : "number" })} /> 시간 입력 사용</label>
        <p>최대 {PROGRAM_LIMITS.items}개까지 등록할 수 있어요. 시간 입력을 꺼도 기존 시간과 식순 내용은 유지됩니다.</p>
        <div className="dd-program-style-chooser"><strong>식순 디자인</strong><div className="dd-program-style-options">{[["card","카드형","기존 리스트 디자인"],["editorial","감성 타임라인형","중앙 아이콘 타임라인"]].map(([id,label,desc])=><button key={id} type="button" aria-pressed={program.style===id} className={program.style===id?"is-selected":""} onClick={()=>patch({style:id})}><span className="dd-program-style-symbol">{id==="card"?"▤":"♧"}</span><strong>{label}</strong><small>{desc}</small></button>)}</div></div>
        {program.items.map((item, index) => <div key={item.id} className="dd-program-editor-item">
          {program.style === "editorial" && <button type="button" className="dd-program-icon-trigger" aria-label={`항목 ${index+1} 클립아트 선택`} onClick={event=>{openerRef.current=event.currentTarget;setCategory("all");setPickerId(item.id)}}>{item.iconId?<ProgramIcon id={item.iconId} size={38}/>:<span>＋<small>클립아트</small></span>}</button>}
          <div className={`dd-program-editor-item-fields${program.displayMode === "time" ? " dd-program-editor-item-fields--time" : ""}`}>
            <label className="form-field"><span>항목 {index + 1} 제목</span><textarea rows={2} value={item.title} maxLength={PROGRAM_LIMITS.itemTitle} onChange={event => updateItem(item.id, { title: event.target.value })} /></label>
            {program.displayMode === "time" && <label className="form-field"><span>항목 {index + 1} 시간</span><input type="time" value={item.time} onChange={event => updateItem(item.id, { time: event.target.value })} /></label>}
          </div>
          <div className="dd-program-editor-actions"><button type="button" className="dd-program-delete-button" aria-label={`항목 ${index + 1} 삭제`} onClick={() => patch({ items: program.items.filter(row => row.id !== item.id) })}>삭제</button></div>
        </div>)}
        <button type="button" className="dd-program-add-button" disabled={program.items.length >= PROGRAM_LIMITS.items} onClick={() => patch({ items: [...program.items, { id: globalThis.crypto?.randomUUID?.() || `program-${Date.now()}-${Math.random().toString(36).slice(2)}`, title: "", time: "" }] })}>+ 항목 추가</button>
    </div>
    {pickerId && <div className="dd-program-icon-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)closePicker()}}><section className="dd-program-icon-picker" role="dialog" aria-modal="true" aria-label="클립아트 선택" tabIndex={-1} ref={pickerRef}><header><strong>클립아트 선택</strong><button type="button" onClick={closePicker} aria-label="닫기">×</button></header><div className="dd-program-icon-categories">{PROGRAM_ICON_CATEGORIES.map(cat=><button type="button" key={cat.id} aria-pressed={category===cat.id} onClick={()=>setCategory(cat.id)}>{cat.label}</button>)}</div><div className="dd-program-icon-grid"><button type="button" onClick={()=>{updateItem(pickerId,{iconId:""});closePicker()}}><span className="dd-program-no-icon">없음</span><small>아이콘 없음</small></button>{PROGRAM_ICONS.filter(icon=>category==="all"||icon.category===category).map(icon=><button type="button" key={icon.id} aria-pressed={program.items.find(item=>item.id===pickerId)?.iconId===icon.id} onClick={()=>{updateItem(pickerId,{iconId:icon.id});closePicker()}}><ProgramIcon id={icon.id} size={37}/><small>{icon.label}</small></button>)}</div></section></div>}
  </div>;
}
