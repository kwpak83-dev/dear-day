import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const json=(body,status=200)=>NextResponse.json(body,{status});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function getAdmin(request){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!url||!key)return {error:"관리자 서비스를 준비하지 못했어요.",status:503};
  if(!token)return {error:"로그인이 필요합니다.",status:401};
  const serverClient=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error}=await serverClient.auth.getUser(token);
  if(error||!user)return {error:"로그인이 만료되었습니다.",status:401};
  const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!publishableKey)return {error:"관리자 서비스를 준비하지 못했어요.",status:503};
  const adminClient=createClient(url,publishableKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{autoRefreshToken:false,persistSession:false}});
  const {data:isAdmin,error:adminError}=await adminClient.rpc("is_admin");
  if(adminError)return {error:"관리자 권한을 확인하지 못했어요.",status:500};
  if(isAdmin!==true)return {error:"관리자만 접근할 수 있습니다.",status:403};
  return {client:serverClient};
}
const cleanSampleContent=(value)=>{
  const s=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  const text=(key,max=500)=>String(s[key]||"").slice(0,max);
  return {
    hero_image_url:text("hero_image_url",2000),groom_name:text("groom_name",80),bride_name:text("bride_name",80),
    groom_father_name:text("groom_father_name",80),groom_mother_name:text("groom_mother_name",80),bride_father_name:text("bride_father_name",80),bride_mother_name:text("bride_mother_name",80),
    event_date:text("event_date",40),event_time:text("event_time",40),venue:text("venue",200),invitation_message:text("invitation_message",2000),
    gallery_images:Array.isArray(s.gallery_images)?s.gallery_images.filter(x=>typeof x==="string"&&x).slice(0,20).map(x=>x.slice(0,2000)):[]
  };
};
const fields=(b)=>{
  if(!b||typeof b.name!=="string"||!b.name.trim()||typeof b.template_key!=="string"||!/^[a-z0-9][a-z0-9_-]{2,79}$/.test(b.template_key)||!uuid.test(b.hero_preset_id||"")||!uuid.test(b.body_template_id||""))return null;
  const price=Number(b.price),sort=Number(b.sort_order);
  if(!Number.isInteger(price)||price<0||!Number.isInteger(sort))return null;
  return {name:b.name.trim(),template_key:b.template_key,category:String(b.category||"wedding"),hero_preset_id:b.hero_preset_id,body_template_id:b.body_template_id,price,description:String(b.description||""),thumbnail_url:b.thumbnail_url||null,thumbnail_1_url:b.thumbnail_1_url||null,thumbnail_2_url:b.thumbnail_2_url||null,sample_content:cleanSampleContent(b.sample_content),is_visible:Boolean(b.is_visible),sort_order:sort,updated_at:new Date().toISOString()};
};
export async function GET(request){
  const a=await getAdmin(request); if(a.error)return json({error:a.error},a.status);
  const [{data,error},{data:heroes},{data:bodies}]=await Promise.all([
    a.client.from("completed_templates").select("*").order("sort_order").order("created_at"),
    a.client.from("hero_presets").select("id,name,status,is_visible").order("sort_order"),
    a.client.from("templates").select("id,name,status,is_visible,current_sale_version_id").order("sort_order")
  ]);
  if(error)return json({error:"완성 템플릿 목록을 불러오지 못했어요."},500);
  return json({items:data||[],heroes:heroes||[],bodies:bodies||[]});
}
export async function POST(request){
  const a=await getAdmin(request); if(a.error)return json({error:a.error},a.status);
  const f=fields(await request.json().catch(()=>null)); if(!f)return json({error:"완성 템플릿 정보를 확인해 주세요."},400);
  const {updated_at,...insert}=f;
  const {error}=await a.client.from("completed_templates").insert({id:randomUUID(),...insert});
  if(error?.code==="23505")return json({error:"이미 사용 중인 template key예요."},409);
  if(error)return json({error:"완성 템플릿을 저장하지 못했어요."},500);
  return json({ok:true},201);
}
export async function PATCH(request){
  const a=await getAdmin(request); if(a.error)return json({error:a.error},a.status);
  const b=await request.json().catch(()=>null); if(!uuid.test(b?.id||""))return json({error:"완성 템플릿을 확인해 주세요."},400);
  const f=fields(b); if(!f)return json({error:"완성 템플릿 정보를 확인해 주세요."},400);
  const {error}=await a.client.from("completed_templates").update(f).eq("id",b.id);
  if(error)return json({error:"완성 템플릿을 수정하지 못했어요."},500);
  return json({ok:true});
}
