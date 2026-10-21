"use client";
import { normalizeProgram, toggleProgram, PROGRAM_LIMITS, PROGRAM_DEFAULTS } from "../../lib/invitation-program";

export default function ProgramEditor({ value, eventKind, onChange }) {
  const program = normalizeProgram(value);
  const patch = values => onChange({ ...program, ...values });
  const updateItem = (id, values) => patch({ items: program.items.map(item => item.id === id ? { ...item, ...values } : item) });
  const move = (index, offset) => {
    const items = [...program.items];
    const next = index + offset;
    if (next < 0 || next >= items.length) return;
    [items[index], items[next]] = [items[next], items[index]];
    patch({ items });
  };
  return <details className="dd-custom-accordion">
    <summary><span><strong>식순·일정 관리</strong><small>행사 순서와 시간을 입력해요.</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary>
    <div className="dd-accordion-body"><div className="form-section">
      <label className="dd-transport-guide-toggle"><input type="checkbox" checked={program.enabled} onChange={event => onChange(toggleProgram(program, event.target.checked, eventKind))} /> 식순·일정 사용</label>
      {program.enabled && <>
        <label>제목<input value={program.title} maxLength={PROGRAM_LIMITS.title} placeholder={PROGRAM_DEFAULTS[eventKind]?.title || "행사 일정"} onChange={event => patch({ title: event.target.value })} /></label>
        <label>표시 방식<select value={program.displayMode} onChange={event => patch({ displayMode: event.target.value })}><option value="number">순서형</option><option value="time">시간형</option><option value="plain">제목형</option></select></label>
        <p>최대 {PROGRAM_LIMITS.items}개까지 등록할 수 있어요. 사용을 꺼도 입력 내용은 유지됩니다.</p>
        {program.items.map((item, index) => <div key={item.id} className="form-section">
          <label>항목 {index + 1} 제목<input value={item.title} maxLength={PROGRAM_LIMITS.itemTitle} onChange={event => updateItem(item.id, { title: event.target.value })} /></label>
          {program.displayMode === "time" && <label>항목 {index + 1} 시간<input type="time" value={item.time} onChange={event => updateItem(item.id, { time: event.target.value })} /></label>}
          <div className="form-grid"><button type="button" className="save-button" aria-label={`항목 ${index + 1} 위로 이동`} disabled={index === 0} onClick={() => move(index, -1)}>위로</button><button type="button" className="save-button" aria-label={`항목 ${index + 1} 아래로 이동`} disabled={index === program.items.length - 1} onClick={() => move(index, 1)}>아래로</button><button type="button" className="save-button" aria-label={`항목 ${index + 1} 삭제`} onClick={() => patch({ items: program.items.filter(row => row.id !== item.id) })}>삭제</button></div>
        </div>)}
        <button type="button" className="save-button" disabled={program.items.length >= PROGRAM_LIMITS.items} onClick={() => patch({ items: [...program.items, { id: globalThis.crypto?.randomUUID?.() || `program-${Date.now()}-${Math.random().toString(36).slice(2)}`, title: "", time: "" }] })}>+ 항목 추가</button>
      </>}
    </div></div>
  </details>;
}
