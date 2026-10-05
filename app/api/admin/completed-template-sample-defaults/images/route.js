import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const bucket="template-assets",maxBytes=15*1024*1024;
const extensions={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
const fail=(error,status)=>Response.json({error},{status});
const safeKind=value=>String(value||"wedding").replace(/[^a-z0-9_-]/gi,"").slice(0,50)||"wedding";
async function admin(request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!url||!key||!publishableKey)return {error:"관리자 서비스를 준비하지 못했어요.",status:503};if(!token)return {error:"로그인이 필요합니다.",status:401};
 const service=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});const {data:{user},error}=await service.auth.getUser(token);if(error||!user)return {error:"로그인이 만료되었습니다.",status:401};
 const verifier=createClient(url,publishableKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{autoRefreshToken:false,persistSession:false}});const {data:isAdmin,error:adminError}=await verifier.rpc("is_admin");if(adminError)return {error:"관리자 권한을 확인하지 못했어요.",status:500};if(isAdmin!==true)return {error:"관리자만 접근할 수 있습니다.",status:403};return {client:service};
}
function validImage(bytes,mime){if(mime==="image/jpeg")return bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if(mime==="image/png")return bytes.length>8&&Buffer.from(bytes.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]));return mime==="image/webp"&&bytes.length>12&&Buffer.from(bytes.subarray(0,4)).toString()==="RIFF"&&Buffer.from(bytes.subarray(8,12)).toString()==="WEBP";}
export async function POST(request){
 const a=await admin(request);if(a.error)return fail(a.error,a.status);const form=await request.formData().catch(()=>null),file=form?.get("file"),eventKind=safeKind(form?.get("eventKind"));
 if(!(file instanceof File)||!extensions[file.type]||!file.size||file.size>maxBytes)return fail("15MB 이하의 JPG, PNG, WebP 이미지를 선택해 주세요.",400);
 const bytes=new Uint8Array(await file.arrayBuffer());if(!validImage(bytes,file.type))return fail("올바른 이미지 파일을 선택해 주세요.",400);
 const path=`completed-template-sample-defaults/${eventKind}/timeline-${randomUUID()}.${extensions[file.type]}`;
 const {error}=await a.client.storage.from(bucket).upload(path,bytes,{contentType:file.type,upsert:false});if(error)return fail("성장 기록 샘플 사진을 업로드하지 못했어요.",500);
 return Response.json({url:a.client.storage.from(bucket).getPublicUrl(path).data.publicUrl});
}
