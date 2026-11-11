import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const reply = (body,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
const pick = u => {
 const m=u.user_metadata||{};
 const email=m.provider==="naver"?(m.email||""):(u.email||m.email||"");
 return {id:u.id,name:m.full_name||m.name||m.nickname||"이름 없음",mobile:m.mobile||"",email:email.endsWith("@accounts.dear-day.com")?"":email,joinedAt:u.created_at,lastSignInAt:u.last_sign_in_at||null,provider:m.provider||u.app_metadata?.provider||""};
};
export async function GET(request){
 const token=request.headers.get("authorization")?.replace(/^Bearer\\s+/i,"");
 if(!token)return reply({error:"로그인이 필요합니다."},401);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,pub=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key||!pub)return reply({error:"관리자 설정을 확인해 주세요."},503);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user)return reply({error:"로그인이 만료되었습니다."},401);
 const allowed=(process.env.DEARDAY_SUPER_ADMIN_IDS||"").split(",").map(x=>x.trim());
 if(!allowed.includes(user.id))return reply({error:"접근 권한이 없습니다."},403);
 const authDb=createClient(url,pub,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:isAdmin,error:adminError}=await authDb.rpc("is_admin");
 if(adminError||isAdmin!==true)return reply({error:"관리자 권한을 확인할 수 없습니다."},403);
 const p=new URL(request.url).searchParams;
 const userId=p.get("userId");
 if(userId){
  if(!/^[0-9a-f-]{36}$/i.test(userId))return reply({error:"잘못된 회원 ID입니다."},400);
  const [{data:account,error:accountError},events,grants]=await Promise.all([
   db.auth.admin.getUserById(userId),
   db.from("events").select("id,status").eq("owner_id",userId),
   db.from("credit_grants").select("quantity,remaining,expires_at").eq("user_id",userId)
  ]);
  if(accountError||!account?.user)return reply({error:"회원을 찾을 수 없습니다."},404);
  if(events.error||grants.error)return reply({error:"회원 통계를 조회하지 못했습니다."},503);
  const now=Date.now();
  return reply({user:pick(account.user),stats:{
   invitationCount:events.data.length,publishedCount:events.data.filter(e=>e.status==="published").length,
   creditsAvailable:grants.data.reduce((n,g)=>n+(new Date(g.expires_at).getTime()>now?g.remaining:0),0),
   creditsIssued:grants.data.reduce((n,g)=>n+g.quantity,0)
  }});
 }
 const page=Math.max(1,Math.min(10000,Number.parseInt(p.get("page")||"1",10)||1));
 const search=(p.get("search")||"").trim().toLowerCase();
 if(search.length>100)return reply({error:"검색어가 너무 깁니다."},400);
 if(search){
  if(search.length<2)return reply({error:"검색어를 2자 이상 입력해 주세요."},400);
  const found=[];
  // Supabase Auth Admin does not support metadata substring search; bounded server-only scan.
  for(let n=1;n<=100;n++){
   const {data,error:listError}=await db.auth.admin.listUsers({page:n,perPage:100});
   if(listError)return reply({error:"회원 검색에 실패했습니다."},503);
   for(const u of data.users||[]){
    const row=pick(u);
    if([row.name,row.mobile,row.email].some(v=>v.toLowerCase().includes(search)))found.push(row);
    if(found.length>=100)break;
   }
   if(found.length>=100||(data.users||[]).length<100)break;
  }
  return reply({users:found,page:1,hasMore:false,searchLimited:found.length>=100});
 }
 const {data,error:listError}=await db.auth.admin.listUsers({page,perPage:30});
 if(listError)return reply({error:"회원 목록을 불러오지 못했습니다."},503);
 return reply({users:(data.users||[]).map(pick),page,hasMore:(data.users||[]).length===30});
}
