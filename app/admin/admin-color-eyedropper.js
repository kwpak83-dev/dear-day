"use client";
import { useState } from "react";

// Read-only color sampler shared by admin Hero and background editors.
export default function AdminColorEyedropper({ compact = false }) {
  const [color, setColor] = useState("");
  const [message, setMessage] = useState("");
  const supported = typeof window !== "undefined" && typeof window.EyeDropper === "function";

  const pick = async () => {
    setMessage("");
    if (!supported) { setMessage("이 브라우저는 스포이드를 지원하지 않습니다. Chrome 또는 Edge에서 사용해 주세요."); return; }
    try {
      const result = await new window.EyeDropper().open();
      if (result?.sRGBHex) setColor(result.sRGBHex.toUpperCase());
    } catch (error) {
      if (error?.name !== "AbortError") setMessage("색상을 추출하지 못했어요. 다시 시도해 주세요.");
    }
  };
  const copy = async () => {
    if (!color) return;
    try {
      await navigator.clipboard.writeText(color);
      setMessage("HEX 색상 코드를 복사했어요.");
    } catch {
      setMessage("복사할 수 없어요. 표시된 코드를 직접 복사해 주세요.");
    }
  };

  if (compact) return <div style={{marginBottom:6}}>
    <button type="button" onClick={pick} disabled={!supported} title="화면에서 색상 추출" style={{padding:"5px 9px",border:"1px solid #d9c8bc",borderRadius:6,background:"#fff",cursor:"pointer",fontSize:12}}>⌖ 스포이드</button>
    {color && <div role="status" style={{display:"flex",alignItems:"center",gap:6,padding:"5px 7px",background:"#fff",border:"1px solid #eadfd8",borderRadius:7,marginTop:5}}>
      <span aria-label={`선택한 색상 ${color}`} style={{width:20,height:20,flexShrink:0,border:"1px solid #bbb",borderRadius:4,backgroundColor:color}}/>
      <code style={{fontSize:12,fontWeight:600}}>{color}</code>
      <button type="button" onClick={copy} style={{marginLeft:"auto",padding:"4px 8px",border:"1px solid #d9c8bc",borderRadius:6,background:"#fff",cursor:"pointer",fontSize:11}}>복사</button>
    </div>}
    {message && <small role="status" style={{display:"block",marginTop:4,color:"#806f66",fontSize:11}}>{message}</small>}
  </div>;
  return <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:8,padding:"8px 10px",marginBottom:10,border:"1px solid #eadfd8",borderRadius:10,background:"#fff"}}>
    <button type="button" className="save-button" onClick={pick} disabled={!supported} title="화면에서 색상 추출">⌖ 스포이드</button>
    {color && <><span aria-label={`선택한 색상 ${color}`} style={{width:24,height:24,display:"inline-block",border:"1px solid #bbb",borderRadius:5,backgroundColor:color}}/><code style={{fontSize:13}}>{color}</code><button type="button" className="save-button" onClick={copy}>HEX 복사</button></>}
    <small style={{color:"#806f66"}}>{message || (supported ? "화면의 글자·이미지·배경을 클릭해 색상을 확인하세요. 설정은 변경되지 않습니다." : "Chrome/Edge 및 HTTPS 또는 localhost에서 사용 가능")}</small>
  </div>;
}
