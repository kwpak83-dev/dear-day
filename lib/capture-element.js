export async function captureElementAsPng(element,{width=600,height=750}={}){
 if(!element)throw new Error("캡처할 미리보기를 찾지 못했어요.");
 const clone=element.cloneNode(true);
 const source=[element,...element.querySelectorAll("*")], target=[clone,...clone.querySelectorAll("*")];
 for(let i=0;i<source.length;i++){const computed=getComputedStyle(source[i]);target[i].setAttribute("style",Array.from(computed).map((key)=>`${key}:${computed.getPropertyValue(key)};`).join(""));}
 const images=[...clone.querySelectorAll("img")];
 await Promise.all(images.map(async(img)=>{try{const response=await fetch(img.src,{cache:"no-store"});const blob=await response.blob();const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});img.removeAttribute("srcset");img.removeAttribute("crossorigin");img.src=data;await new Promise((resolve)=>{if(img.complete)return resolve();img.onload=()=>resolve();img.onerror=()=>resolve();});}catch{img.remove();}}));
 clone.style.width=element.offsetWidth+"px";clone.style.height=element.offsetHeight+"px";clone.style.margin="0";
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${element.offsetWidth}" height="${element.offsetHeight}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${new XMLSerializer().serializeToString(clone)}</div></foreignObject></svg>`;
 const url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}));
 try{const image=await new Promise((resolve,reject)=>{const value=new Image();value.onload=()=>resolve(value);value.onerror=reject;value.src=url;});const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0,width,height);return await new Promise((resolve,reject)=>canvas.toBlob((blob)=>blob?resolve(blob):reject(new Error("썸네일 이미지를 만들지 못했어요.")),"image/png",.92));}finally{URL.revokeObjectURL(url);}
}