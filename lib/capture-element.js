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

export async function captureBodyThemeThumbnail({backgroundUrl="",decorationUrl="",width=600,height=750}={}){
 const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("브라우저에서 썸네일 캔버스를 만들지 못했어요.");
 roundedRect(ctx,0,0,width,height,28);ctx.clip();ctx.fillStyle="#fffaf6";ctx.fillRect(0,0,width,height);
 if(backgroundUrl){const image=await loadSafeImage(backgroundUrl);ctx.drawImage(image,0,0,width,height);}
 ctx.textAlign="center";ctx.fillStyle="#7b5c50";ctx.font="18px serif";ctx.fillText("INVITATION",width/2,115);ctx.font="38px serif";ctx.fillText("소중한 날에",width/2,180);ctx.fillText("함께해 주세요",width/2,228);
 ctx.font="20px serif";ctx.fillText("2026. 10. 17  ·  SATURDAY",width/2,305);
 ctx.strokeStyle="rgba(123,92,80,.25)";ctx.beginPath();ctx.moveTo(110,345);ctx.lineTo(width-110,345);ctx.stroke();
 ctx.font="26px serif";ctx.fillText("마음을 담아 초대합니다",width/2,420);ctx.font="17px sans-serif";ctx.fillText("서로의 곁에서 같은 곳을 바라보며",width/2,470);ctx.fillText("새로운 시작을 함께하려 합니다.",width/2,500);
 ctx.fillStyle="rgba(255,255,255,.72)";roundedRect(ctx,90,555,width-180,105,18);ctx.fill();ctx.fillStyle="#7b5c50";ctx.font="17px sans-serif";ctx.fillText("디어데이 웨딩홀",width/2,600);ctx.fillText("서울특별시 중구 세종대로 110",width/2,632);
 if(decorationUrl){const image=await loadSafeImage(decorationUrl);ctx.drawImage(image,0,0,width,height);}
 return await new Promise((resolve,reject)=>canvas.toBlob((blob)=>blob?resolve(blob):reject(new Error("본문 테마 썸네일 이미지를 만들지 못했어요.")),"image/png",.92));
}
