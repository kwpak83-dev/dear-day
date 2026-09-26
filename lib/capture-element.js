function roundedRect(ctx,x,y,w,h,r){const q=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+q,y);ctx.arcTo(x+w,y,x+w,y+h,q);ctx.arcTo(x+w,y+h,x,y+h,q);ctx.arcTo(x,y+h,x,y,q);ctx.arcTo(x,y,x+w,y,q);ctx.closePath();}
async function loadSafeImage(src){const response=await fetch(src,{cache:"no-store"});if(!response.ok)throw new Error("Hero 프레임 이미지를 불러오지 못했어요.");const blob=await response.blob();const url=URL.createObjectURL(blob);try{return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("Hero 프레임 이미지를 읽지 못했어요."));image.src=url;});}finally{setTimeout(()=>URL.revokeObjectURL(url),0);}}
export async function captureHeroThumbnail({frameUrl,width=600,height=750}={}){
 const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("브라우저에서 썸네일 캔버스를 만들지 못했어요.");
 roundedRect(ctx,0,0,width,height,28);ctx.clip();
 const gradient=ctx.createLinearGradient(0,0,width,height);gradient.addColorStop(0,"#ddd0c7");gradient.addColorStop(.48,"#f7eee8");gradient.addColorStop(1,"#c7b4a7");ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
 ctx.textAlign="center";ctx.fillStyle="#ffffff";ctx.shadowColor="rgba(0,0,0,.25)";ctx.shadowBlur=12;ctx.font="24px serif";ctx.fillText("DEAR DAY",width/2,height*.39);ctx.font="46px serif";ctx.fillText("GROOM & BRIDE",width/2,height*.49);ctx.font="24px serif";ctx.fillText("2026. 10. 17",width/2,height*.57);ctx.shadowBlur=0;
 if(frameUrl){const frame=await loadSafeImage(frameUrl);ctx.drawImage(frame,0,0,width,height);}
 return await new Promise((resolve,reject)=>canvas.toBlob((blob)=>blob?resolve(blob):reject(new Error("썸네일 이미지를 만들지 못했어요.")),"image/png",.92));
}
