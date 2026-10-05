export default function AdminDesignNav({ current = "" }) {
  const items = [
    ["hero", "/admin/hero-presets", "Hero 프레임 관리"],
    ["body", "/admin/templates", "본문 테마 관리"],
    ["completed", "/admin/completed-templates", "완성 템플릿 관리"],
    ["event-types", "/admin/event-types", "행사 유형 관리"],
  ];
  return <nav aria-label="디자인 관리자 이동" style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",margin:"8px 0 16px"}}>
    {items.map(([key,href,label],index)=><span key={key} style={{display:"contents"}}>
      {index>0&&<span aria-hidden="true" style={{color:"#9b8b82"}}>·</span>}
      <a href={href} aria-current={current===key?"page":undefined} style={{fontWeight:current===key?800:500,textDecoration:current===key?"underline":"none"}}>{label} →</a>
    </span>)}
  </nav>;
}
