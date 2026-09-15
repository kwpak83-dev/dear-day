export const EMPTY_RSVP = { guestName: "", status: "", partySize: "", phone: "", message: "" };

export function validateRsvp(form) {
  if (!form.guestName.trim() || form.guestName.trim().length > 50) return "이름을 50자 이내로 입력해 주세요.";
  if (!form.status) return "참석 여부를 선택해 주세요.";
  const partySize = form.partySize === "" ? 1 : Number(form.partySize);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 20) return "참석 인원은 1명부터 20명까지 입력해 주세요.";
  if (form.phone.trim().length > 30) return "연락처를 30자 이내로 입력해 주세요.";
  if (form.message.trim().length > 200) return "전달사항은 200자 이내로 입력해 주세요.";
  return "";
}

export default function RsvpFields({ form, update }) {
  return <>
    <label><span>이름 <b>필수</b></span><input value={form.guestName} onChange={(event) => update("guestName", event.target.value)} maxLength="50" autoComplete="name" required /></label>
    <fieldset><legend>참석 여부 <b>필수</b></legend><div className="rsvp-status-options"><label><input type="radio" name="rsvp-status" value="attending" checked={form.status === "attending"} onChange={(event) => update("status", event.target.value)} /><span>참석</span></label><label><input type="radio" name="rsvp-status" value="not_attending" checked={form.status === "not_attending"} onChange={(event) => update("status", event.target.value)} /><span>불참</span></label></div></fieldset>
    <label><span>참석 인원 <small>선택</small></span><select value={form.partySize} onChange={(event) => update("partySize", event.target.value)}><option value="">선택 안 함</option>{Array.from({ length: 20 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}명</option>)}</select></label>
    <label><span>연락처 <small>선택</small></span><input type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} maxLength="30" autoComplete="tel" /></label>
    <label><span>전달사항 <small>선택</small></span><textarea value={form.message} onChange={(event) => update("message", event.target.value)} maxLength="200" rows="4" /><small className="rsvp-count">{form.message.length}/200</small></label>
  </>;
}