"use client";

import { useState } from "react";

// Static promotional examples only: no visitor information, database calls or admin actions.
const responses = [
  { role: "신랑", name: "김철", attending: false, count: "—", meal: "—", bus: "—" },
  { role: "신부", name: "김현아 외 부서원", attending: true, count: "3명", meal: true, bus: false },
  { role: "신랑", name: "박경 및 마케팅팀", attending: true, count: "5명", meal: true, bus: true },
];
const messages = [
  { name: "최기철", time: "2026. 11. 13. 오후 2:43", message: "정우 드디어 장가가네 ㅋㅋ 결혼식날 보자~!" },
  { name: "김철", time: "2026. 11. 13. 오후 2:30", message: "정우야 미안 😞 급출장 생겨서" },
  { name: "김현아", time: "2026. 11. 13. 오후 2:29", message: "축하해 수지야 ♡" },
  { name: "박경", time: "2026. 11. 13. 오후 2:27", message: "추카추카" },
];
const tabs = [{ id: "attendance", label: "참석여부" }, { id: "guestbook", label: "방명록" }];
function AttendanceDemo() {
  const [filter, setFilter] = useState("전체");
  const filtered = responses.filter(row => filter === "전체" || (filter === "참석" ? row.attending : !row.attending));
  return <div className="dd-rsvp-live">
    <div className="dd-rsvp-live-status">RSVP ON</div>
    <section className="dd-rsvp-live-summary">
      <div className="dd-rsvp-live-total"><span>전체 응답 <span aria-label="응답 현황 안내">ⓘ</span></span><strong>3<small>건</small></strong></div>
      <div className="dd-rsvp-live-progress"><span /></div>
      <p>참석 응답 2건 · 전체 응답 대비 67%</p>
      <div className="dd-rsvp-live-stats">
        <div><span>👥 참석 인원</span><strong>8명</strong></div><div><span>🍽️ 식사</span><strong>8명</strong></div>
        <div><span>🚌 전세버스</span><strong>5명</strong></div><div><span>💌 불참 응답</span><strong>1건</strong></div>
      </div>
      <div className="dd-rsvp-live-sides"><span>신랑 측&nbsp; <b>5명</b></span><span>신부 측&nbsp; <b>3명</b></span></div>
    </section>
    <div className="dd-rsvp-live-filters">{["전체","참석","불참"].map(value=><button key={value} type="button" className={filter===value?"is-active":""} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value}</button>)}<span>{filtered.length}건</span></div>
    <div className="dd-rsvp-live-table" role="table" aria-label="참석 응답 예시">
      <div className="dd-rsvp-live-tr dd-rsvp-live-th" role="row"><span>작성자</span><span>참석</span><span>인원</span><span>식사</span><span>버스</span></div>
      {filtered.map(row=><div className="dd-rsvp-live-tr" role="row" key={row.name}><span><b className={row.role==="신부"?"bride":"groom"}>{row.role}</b> {row.name}</span><span className={row.attending?"yes":"no"}>{row.attending?"○":"×"}</span><span>{row.count}</span><span className={row.meal===true?"yes":"no"}>{row.meal===true?"○":"—"}</span><span className={row.bus===true?"yes":"no"}>{row.bus===true?"○":row.bus===false?"×":"—"}</span></div>)}
    </div>
    <div className="dd-rsvp-live-export">▤ Excel 다운로드</div>
  </div>;
}
function GuestbookDemo() {
  return <div className="dd-rsvp-guestbook">
    <div className="dd-rsvp-guestbook-heading"><strong>방명록 관리 <span>ⓘ</span></strong><span>4건</span></div>
    {messages.map(item=><article key={item.name} className="dd-rsvp-guestbook-card">
      <div className="dd-rsvp-guestbook-meta"><strong>{item.name}</strong><time>{item.time}</time></div>
      <p>{item.message}</p>
      <span className="dd-rsvp-guestbook-delete" aria-label="관리자 삭제 버튼 예시">삭제</span>
    </article>)}
  </div>;
}
export default function LandingSmartRsvpDemo() {
  const [active,setActive]=useState("attendance");
  return <div className="dd-landing-rsvp-demo">
    <div className="dd-landing-rsvp-tabs" role="group" aria-label="관리 화면 선택">
      {tabs.map(tab=><button key={tab.id} type="button" className={active===tab.id?"is-active":""} aria-pressed={active===tab.id} onClick={()=>setActive(tab.id)}>{tab.label}</button>)}
    </div>
    <div className="dd-landing-rsvp-scroll" tabIndex={0} aria-label={active==="attendance"?"참석여부 관리 화면 예시":"방명록 관리 화면 예시"}>
      {active==="attendance"?<AttendanceDemo/>:<GuestbookDemo/>}
    </div>
    <p className="dd-landing-rsvp-note">탭을 눌러 관리 화면을 확인해 보세요</p>
  </div>;
}
