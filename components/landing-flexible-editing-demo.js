export default function LandingFlexibleEditingDemo(){
 const features=[["🖼️","사진 변경"],["🗓️","일정 수정"],["🎨","디자인 변경"],["📝","내용 수정"]];
 return <div className="dd-flex-edit">
  <div className="dd-flex-edit-head"><span>07 / 07</span><b>FLEXIBLE EDITING</b></div>
  <div className="dd-flex-edit-title"><span>발행 후에도 자유롭게</span><strong>발행은 한 번,<br/><em>수정은 자유롭게.</em></strong><p>사진부터 행사 정보, 디자인까지<br/>발행 후에도 언제든<br/>변경할 수 있어요.</p></div>
  <div className="dd-flex-edit-invite" aria-hidden="true">
   <div className="dd-flex-edit-flower">🌿 <span>♡</span> 🌿</div>
   <small>Our Wedding</small><b>정우 <span style={{color:"#e87581"}}>♡</span> 수지</b><span>2026.11.01 · 오후 2시</span>
   <div className="dd-flex-edit-scenery"><span>🌸</span><span className="dd-flex-edit-couple">🤵🏻‍♂️ 👰🏻‍♀️</span><span>🌷</span></div>
   <i>✏️</i>
  </div>
  <div className="dd-flex-edit-panel"><div className="dd-flex-edit-status"><span>✓</span><strong>초대장 발행 완료</strong><small>DearDay</small></div><div className="dd-flex-edit-options">{features.map(([icon,label])=><div key={label}><span aria-hidden="true">{icon}</span><b>{label}</b></div>)}</div><div className="dd-flex-edit-note"><span>🔄</span> 수정 후에도 기존 초대장 링크는<br/><strong>그대로 유지돼요.</strong></div></div>
 </div>;
}
