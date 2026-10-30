export const EMPTY_RSVP = { guestName: "", status: "", partySize: "", phone: "", message: "", guestSide: "", mealAttending: null, busRiding: null };

export function validateRsvp(form, { wedding = false, mealEnabled = false, busEnabled = false } = {}) {
  if (!form.guestName.trim() || form.guestName.trim().length > 50) return "이름을 50자 이내로 입력해 주세요.";
  if (!["attending", "not_attending"].includes(form.status)) return "참석 여부를 선택해 주세요.";
  if (wedding && !["groom", "bride"].includes(form.guestSide)) return "신랑 측 또는 신부 측을 선택해 주세요.";
  if (form.status === "attending" && mealEnabled && typeof form.mealAttending !== "boolean") return "식사 여부를 선택해 주세요.";
  if (form.status === "attending" && busEnabled && typeof form.busRiding !== "boolean") return "전세버스 탑승 여부를 선택해 주세요.";
  const partySize = form.partySize === "" ? 1 : Number(form.partySize);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 20) return "참석 인원은 1명부터 20명까지 입력해 주세요.";
  if (form.phone.trim().length > 30) return "연락처를 30자 이내로 입력해 주세요.";
  if (form.message.trim().length > 200) return "전달사항을 200자 이내로 입력해 주세요.";
  return "";
}

function Choice({ label, name, value, options, update }) {
  return <fieldset><legend>{label} <b>필수</b></legend><div className="rsvp-status-options">{options.map(([key, text]) => <label key={String(key)}><input type="radio" name={name} checked={value === key} onChange={() => update(key)} /><span>{text}</span></label>)}</div></fieldset>;
}

export default function RsvpFields({ form, update, wedding = false, mealEnabled = false, busEnabled = false }) {
  return <>
    {wedding && <Choice label="하객 구분" name="rsvp-guest-side" value={form.guestSide} options={[["groom", "신랑 측"], ["bride", "신부 측"]]} update={(value) => update("guestSide", value)} />}
    <Choice label="참석 여부" name="rsvp-status" value={form.status} options={[["attending", "참석"], ["not_attending", "불참"]]} update={(value) => update("status", value)} />
    {form.status === "attending" && mealEnabled && <Choice label="식사 여부" name="rsvp-meal" value={form.mealAttending} options={[[true, "식사함"], [false, "식사 안 함"]]} update={(value) => update("mealAttending", value)} />}
    {form.status === "attending" && busEnabled && <Choice label="전세버스 탑승" name="rsvp-bus" value={form.busRiding} options={[[true, "탑승"], [false, "탑승 안 함"]]} update={(value) => update("busRiding", value)} />}
    <label><span>이름 <b>필수</b></span><input value={form.guestName} onChange={(event) => update("guestName", event.target.value)} maxLength="50" autoComplete="name" required /></label>
    <label><span>참석 인원 <small>선택</small></span><select value={form.partySize} onChange={(event) => update("partySize", event.target.value)}><option value="">선택 안 함</option>{Array.from({ length: 20 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}명</option>)}</select></label>
    <label><span>연락처 <small>선택</small></span><input type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} maxLength="30" autoComplete="tel" /></label>
    <label><span>전달사항 <small>선택</small></span><textarea value={form.message} onChange={(event) => update("message", event.target.value)} maxLength="200" rows="4" /><small className="rsvp-count">{form.message.length}/200</small></label>
  </>;
}
