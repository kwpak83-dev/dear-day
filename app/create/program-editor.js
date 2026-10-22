"use client";
import { normalizeProgram, PROGRAM_LIMITS, PROGRAM_DEFAULTS } from "../../lib/invitation-program";

export default function ProgramEditor({ value, eventKind, onChange }) {
  const program = normalizeProgram(value);
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
        {program.items.map((item, index) => <div key={item.id} className="dd-program-editor-item">
          <div className={`dd-program-editor-item-fields${program.displayMode === "time" ? " dd-program-editor-item-fields--time" : ""}`}>
            <label className="form-field"><span>항목 {index + 1} 제목</span><input value={item.title} maxLength={PROGRAM_LIMITS.itemTitle} onChange={event => updateItem(item.id, { title: event.target.value })} /></label>
            {program.displayMode === "time" && <label className="form-field"><span>항목 {index + 1} 시간</span><input type="time" value={item.time} onChange={event => updateItem(item.id, { time: event.target.value })} /></label>}
          </div>
          <div className="dd-program-editor-actions"><button type="button" className="dd-program-delete-button" aria-label={`항목 ${index + 1} 삭제`} onClick={() => patch({ items: program.items.filter(row => row.id !== item.id) })}>삭제</button></div>
        </div>)}
        <button type="button" className="dd-program-add-button" disabled={program.items.length >= PROGRAM_LIMITS.items} onClick={() => patch({ items: [...program.items, { id: globalThis.crypto?.randomUUID?.() || `program-${Date.now()}-${Math.random().toString(36).slice(2)}`, title: "", time: "" }] })}>+ 항목 추가</button>
    </div>
  </div>;
}
