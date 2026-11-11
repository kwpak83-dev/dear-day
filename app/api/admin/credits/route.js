import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
const json=(data,status=200)=>NextResponse.json(data,{status});
async function context(request){
 const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!token) return {error:"로그인이 필요합니다.",status:401};
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key||!publishableKey) return {error:"관리자 서비스를 준비하지 못했어요.",status:503};
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user) return {error:"로그인이 만료되었습니다.",status:401};
 const adminDb=createClient(url,publishableKey,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:isAdmin,error:adminError}=await adminDb.rpc("is_admin");
 if(adminError)return {error:"관리자 권한 확인에 실패했어요.",status:503};
 if(isAdmin!==true)return {error:"관리자만 이용권을 조회할 수 있어요.",status:403};
 const allowed=(process.env.DEARDAY_SUPER_ADMIN_IDS||"").split(",").map(s=>s.trim()).filter(Boolean);
 return {db,user,canManage:allowed.includes(user.id)};

}
export async function GET(request){
 const ctx=await context(request);if(ctx.error)return json({error:ctx.error},ctx.status);
 const params=new URL(request.url).searchParams;
 const search=params.get("search")?.trim();
 if(search){
  if(search.length<2)return json({error:"검색어는 2자 이상 입력해 주세요."},400);
  const matches=[];
  // Server-side privileged search; never expose full member lists to clients.
  for(let page=1;page<=10;page++){
   const {data,error}=await ctx.db.auth.admin.listUsers({page,perPage:100});
   if(error)return json({error:"회원 검색에 실패했어요."},503);
   for(const u of data.users||[]){
    const m=u.user_metadata||{};
    const fields=[u.id,m.name,m.nickname,m.mobile,m.email,u.email];
    if(fields.some(v=>typeof v==="string"&&v.toLowerCase().includes(search.toLowerCase())))
      matches.push({id:u.id,name:m.name||m.nickname||"이름 없음",mobile:m.mobile||"",email:m.email||""});
    if(matches.length>=20)break;
   }
   if(matches.length>=20||(data.users||[]).length<100)break;
  }
  return json({users:matches});
 }
 const query=params.get("userId");
 if(!query||!/^[0-9a-f-]{36}$/i.test(query))return json({error:"회원 ID를 입력해 주세요."},400);
 const [grants,ledger]=await Promise.all([
 ctx.db.from("credit_grants").select("*").eq("user_id",query).order("created_at",{ascending:false}).limit(100),
 ctx.db.from("credit_ledger").select("*").eq("user_id",query).order("created_at",{ascending:false}).limit(100)
 ]);
 if(grants.error||ledger.error)return json({error:"이용권 조회에 실패했어요."},503);
 return json({grants:grants.data,ledger:ledger.data});
}
export async function POST(request){
 const ctx=await context(request);if(ctx.error)return json({error:ctx.error},ctx.status);
 if(!ctx.canManage)return json({error:"이용권 지급·회수에는 DEARDAY_SUPER_ADMIN_IDS에 관리자 계정 UUID 등록이 필요해요."},403);
 const b=await request.json().catch(()=>null);
 if(!b||typeof b!=="object")return json({error:"요청 형식이 올바르지 않아요."},400);
 const reason=typeof b.reason==="string"?b.reason.trim():"";
 if(reason.length<2||reason.length>200)return json({error:"지급/회수 사유를 입력해 주세요."},400);
 let result;
 if(b.action==="grant"){
  const expires=new Date(b.expiresAt);
  if(!Number.isInteger(b.quantity)||b.quantity<1||b.quantity>10000||!Number.isFinite(expires.getTime())||expires.getTime()<=Date.now())return json({error:"수량 또는 유효기간이 올바르지 않아요."},400);
  result=await ctx.db.rpc("credit_issue_admin",{p_user:b.userId,p_actor:ctx.user.id,p_quantity:b.quantity,p_expires:expires.toISOString(),p_reason:reason,p_note:typeof b.note==="string"?b.note.slice(0,500):null});
 }else if(b.action==="revoke"){
  if(!Number.isInteger(b.quantity)||b.quantity<1||typeof b.grantId!=="string")return json({error:"회수 정보를 확인해 주세요."},400);
  result=await ctx.db.rpc("credit_revoke_admin",{p_grant:b.grantId,p_actor:ctx.user.id,p_quantity:b.quantity,p_reason:reason});
 }else return json({error:"지원하지 않는 작업이에요."},400);
 if(result.error){
  console.error("[admin/credits] credit RPC failed",{action:b.action,code:result.error.code,message:result.error.message,details:result.error.details,hint:result.error.hint});
  const code=result.error.code;
  const message=result.error.message||"";
  if(code==="PGRST202"||code==="42883")return json({error:"이용권 DB 함수가 없습니다. Supabase SQL Editor에서 202611110004_manual_credits.sql 마이그레이션 적용 여부를 확인해 주세요.",code},503);
  if(code==="42P01")return json({error:"이용권 DB 테이블이 없습니다. Supabase 마이그레이션을 적용해 주세요.",code},503);
  if(code==="42501")return json({error:"DB 함수 실행 권한이 없습니다. 마이그레이션의 GRANT 설정을 확인해 주세요.",code},503);
  if(message.includes("INVALID_CREDIT_GRANT"))return json({error:"이용권 수량·만료일·지급 사유를 확인해 주세요.",code},400);
  if(message.includes("USER_NOT_FOUND"))return json({error:"선택한 회원을 찾을 수 없어요.",code},404);
  if(message.includes("INSUFFICIENT_UNUSED_CREDITS"))return json({error:"회수할 미사용 이용권이 부족해요.",code},409);
  return json({error:"이용권 처리에 실패했어요. 서버 로그에서 오류 코드 "+(code||"unknown")+"를 확인해 주세요.",code},500);
 }
 return json({ok:true,result:result.data});
}
