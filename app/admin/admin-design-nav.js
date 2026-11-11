export default function AdminDesignNav({ current = "" }) {
  const items = [
    ["hero", "/admin/hero-presets", "Hero 프레임 관리"],
    ["body", "/admin/templates", "본문 테마 관리"],
    ["completed", "/admin/completed-templates", "완성 템플릿 관리"],
    ["event-types", "/admin/event-types", "행사 유형 관리"],
    ["bgm", "/admin/bgm", "공용 BGM 관리"],
    ["credits", "/admin/credits", "이용권 관리"],
    ["members", "/admin/members", "전체 회원 관리"],
    ["deletion-logs", "/admin/deletion-logs", "삭제 로그 관리"],
  ];
  return <nav aria-label="디자인 관리자 이동" style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",margin:"8px 0 16px"}}>
    {items.map(([key,href,label],index)=><span key={key} style={{display:"contents"}}>
      {index>0&&<span aria-hidden="true" style={{color:"#9b8b82"}}>·</span>}
      <a href={href} aria-current={current===key?"page":undefined} style={{fontWeight:current===key?800:500,textDecoration:current===key?"underline":"none"}}>{label} →</a>
    </span>)}
    <a href="/" aria-label="디어데이 메인페이지로 이동" style={{marginLeft:"auto",display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"9px 14px",border:"1px solid #cbd2df",borderRadius:8,background:"#fff",color:"#263e80",fontSize:13,fontWeight:600,textDecoration:"none",whiteSpace:"nowrap"}}>← 디어데이 홈으로</a>
  </nav>;
}
