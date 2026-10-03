export const dynamic="force-dynamic";
export const revalidate=0;
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const bucket="template-assets",folder="hero-decoration-library",maxBytes=15*1024*1024;
const extensions={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
const fail=(error,status)=>Response.json({error},{status});
async function admin(request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!url||!key)return {error:"관리자 서비스를 준비하지 못했어요.",status:503};if(!token)return {error:"로그인이 필요합니다.",status:401};
 const client=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:{user},error}=await client.auth.getUser(token);if(error||!user)return {error:"로그인이 만료되었습니다.",status:401};
 const publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!publishable)return {error:"관리자 서비스를 준비하지 못했어요.",status:503};
 const signed=createClient(url,publishable,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{autoRefreshToken:false,persistSession:false}});
 const {data:isAdmin,error:adminError}=await signed.rpc("is_admin");if(adminError)return {error:"관리자 권한을 확인하지 못했어요.",status:500};if(isAdmin!==true)return {error:"관리자만 접근할 수 있습니다.",status:403};
 return {client};
}
function validImage(bytes,mime){if(mime==="image/jpeg")return bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if(mime==="image/png")return bytes.length>8&&Buffer.from(bytes.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]));return mime==="image/webp"&&bytes.length>12&&Buffer.from(bytes.subarray(0,4)).toString()==="RIFF"&&Buffer.from(bytes.subarray(8,12)).toString()==="WEBP";}
function item(client,file){const id=file.name.split(".")[0];return {id,name:file.metadata?.originalName||file.name,url:client.storage.from(bucket).getPublicUrl(`${folder}/${file.name}`).data.publicUrl,created_at:file.created_at||null};}
export async function GET(request){const a=await admin(request);if(a.error)return fail(a.error,a.status);const {data,error}=await a.client.storage.from(bucket).list(folder,{limit:1000,sortBy:{column:"created_at",order:"desc"}});if(error)return fail("장식 라이브러리를 불러오지 못했어요.",500);return Response.json({assets:(data||[]).filter(x=>/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(x.name)).map(x=>item(a.client,x))},{headers:{"Cache-Control":"no-store"}});}
export async function POST(request){const a=await admin(request);if(a.error)return fail(a.error,a.status);const form=await request.formData().catch(()=>null),file=form?.get("file");if(!(file instanceof File)||!extensions[file.type]||!file.size||file.size>maxBytes)return fail("15MB 이하의 JPG, PNG, WebP 이미지를 선택해 주세요.",400);const bytes=new Uint8Array(await file.arrayBuffer());if(!validImage(bytes,file.type))return fail("올바른 이미지 파일을 선택해 주세요.",400);const id=randomUUID(),name=`${id}.${extensions[file.type]}`,path=`${folder}/${name}`;const {error}=await a.client.storage.from(bucket).upload(path,bytes,{contentType:file.type,upsert:false,metadata:{originalName:file.name.slice(0,200)}});if(error)return fail("장식 라이브러리에 이미지를 저장하지 못했어요.",500);return Response.json({id,name:file.name.slice(0,200),url:a.client.storage.from(bucket).getPublicUrl(path).data.publicUrl},{status:201});}

export async function DELETE(request){
 const a=await admin(request);if(a.error)return fail(a.error,a.status);
 const id=new URL(request.url).searchParams.get("id");
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id||""))return fail("삭제할 장식 정보가 올바르지 않아요.",400);
 const {data:presets,error:presetError}=await a.client.from("hero_presets").select("id,name,config");
 if(presetError)return fail("장식 사용 여부를 확인하지 못했어요.",500);
 const used=(presets||[]).filter(p=>Array.isArray(p.config?.decorLayers)&&p.config.decorLayers.some(layer=>layer?.assetId===id));
 if(used.length)return Response.json({error:`현재 ${used.length}개 Hero에서 사용 중인 장식입니다. Hero에서 먼저 제거한 뒤 삭제해 주세요.`,usedBy:used.map(p=>({id:p.id,name:p.name}))},{status:409});
 const {data:files,error:listError}=await a.client.storage.from(bucket).list(folder,{limit:1000});
 if(listError)return fail("장식 파일을 확인하지 못했어요.",500);
 const file=(files||[]).find(x=>x.name.startsWith(`${id}.`));if(!file)return fail("장식 파일을 찾지 못했어요.",404);
 const {error:removeError}=await a.client.storage.from(bucket).remove([`${folder}/${file.name}`]);if(removeError)return fail("장식 파일을 삭제하지 못했어요.",500);
 return Response.json({id});
}
