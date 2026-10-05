import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const json=(body,status=200)=>NextResponse.json(body,{status});
const STATES=new Set(["required","optional","none"]);
const KEY=/^[a-z][a-z0-9_]{1,49}$/;

async function admin(request){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!url||!publishableKey||!serviceRoleKey)return{error:"관리자 서비스를 준비하지 못했어요.",status:503};
  if(!token)return{error:"로그인이 필요합니다.",status:401};
  const serverClient=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error}=await serverClient.auth.getUser(token);
  if(error||!user)return{error:"로그인이 만료되었습니다.",status:401};
  const client=createClient(url,publishableKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{autoRefreshToken:false,persistSession:false}});
  const {data:isAdmin,error:adminError}=await client.rpc("is_admin");
  if(adminError||isAdmin!==true)return{error:"관리자 권한이 필요합니다.",status:403};
  return{serverClient,user};
}
function cleanFields(value){
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const out={};
  for(const [key,item] of Object.entries(value)){
    if(!KEY.test(key)||!item||!STATES.has(item.state))return null;
    out[key]={state:item.state,label:String(item.label||"").trim().slice(0,80)};
  }
  return out;
}
export async function GET(request){
  const auth=await admin(request); if(auth.error)return json({error:auth.error},auth.status);
  const {data,error}=await auth.serverClient.from("event_type_configs").select("kind,label,is_visible,sort_order,fields").order("sort_order");
  if(error)return json({error:"행사 유형 설정을 불러오지 못했어요.",detail:error.message},500);
  return json({types:data||[]});
}
export async function POST(request){
  const auth=await admin(request); if(auth.error)return json({error:auth.error},auth.status);
  const body=await request.json().catch(()=>null);
  const kind=String(body?.kind||"").trim(), label=String(body?.label||"").trim();
  const fields=cleanFields(body?.fields);
  if(!KEY.test(kind)||!label||label.length>60||!fields)return json({error:"행사 유형 정보를 확인해 주세요."},400);
  const {error}=await auth.serverClient.from("event_type_configs").insert({kind,label,is_visible:body?.is_visible!==false,sort_order:Number.isInteger(body?.sort_order)?body.sort_order:0,fields});
  if(error?.code==="23505")return json({error:"이미 사용 중인 유형 key예요."},409);
  if(error)return json({error:"행사 유형을 추가하지 못했어요.",detail:error.message},500);
  return json({kind},201);
}
export async function PATCH(request){
  const auth=await admin(request); if(auth.error)return json({error:auth.error},auth.status);
  const body=await request.json().catch(()=>null);
  const kind=String(body?.kind||"").trim(), label=String(body?.label||"").trim();
  const fields=cleanFields(body?.fields);
  if(!KEY.test(kind)||!label||label.length>60||!fields)return json({error:"행사 유형 정보를 확인해 주세요."},400);
  const {error}=await auth.serverClient.from("event_type_configs").update({label,is_visible:body?.is_visible!==false,sort_order:Number.isInteger(body?.sort_order)?body.sort_order:0,fields,updated_at:new Date().toISOString()}).eq("kind",kind);
  if(error)return json({error:"행사 유형을 저장하지 못했어요.",detail:error.message},500);
  return json({kind});
}