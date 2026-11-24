"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export default function DeveloperToolGuard() {
  const pathname = usePathname();
  const excluded = pathname === "/admin" || pathname?.startsWith("/admin/");
  const [open, setOpen] = useState(false);
  const confirmRef = useRef(null);
  useEffect(() => {
    setOpen(false);
    if (excluded) return;
    const onKey = (event) => {
      const key = event.key.toLowerCase();
      const blocked = key === "f12" ||
        (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key)) ||
        (event.metaKey && event.altKey && ["i", "j", "c", "u"].includes(key)) ||
        (event.ctrlKey && !event.shiftKey && !event.altKey && key === "u");
      if (!blocked) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [excluded, pathname]);
  useEffect(() => {
    if (!open || excluded) return;
    const previous = document.activeElement;
    confirmRef.current?.focus();
    const onKey = event => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") { event.preventDefault(); confirmRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [open, excluded]);
  if (!open || excluded) return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:2147483647,display:"grid",placeItems:"center",padding:20,background:"rgba(91,77,67,.42)",backdropFilter:"blur(4px)"}}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="dd-tool-title" aria-describedby="dd-tool-description" style={{boxSizing:"border-box",width:"100%",maxWidth:320,borderRadius:16,background:"#fff",padding:20,textAlign:"center",color:"#5B4D43",fontFamily:'Pretendard, "Noto Sans KR", sans-serif'}}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2 4 6v6c0 5 4 8 8 10 4-2 8-5 8-10V6l-8-4Z"/><path d="M12 8v4m0 4h.01"/></svg>
        <h2 id="dd-tool-title" style={{fontSize:18,fontWeight:700,margin:"12px 0"}}>개발자 도구 사용 제한</h2>
        <p id="dd-tool-description" style={{fontSize:14,color:"#89786e",margin:"0 0 12px"}}>개발자 도구는 사용할 수 없습니다.</p>
        <button ref={confirmRef} type="button" onClick={()=>setOpen(false)} style={{width:"100%",height:50,border:0,borderRadius:8,background:"#5B4D43",color:"#fff",font:"inherit",fontWeight:600,cursor:"pointer"}}>확인</button>
      </section>
    </div>
  );
}
