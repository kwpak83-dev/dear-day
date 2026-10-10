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
  const s=value&&typeof value==="object"&&!Array.isArray(value)?value:{},text=(key,max=500)=>String(s[key]||"").slice(0,max);
  return {
    hero_image_url:text("hero_image_url",2000),child_name:text("child_name",80),child_last_name:text("child_last_name",80),child_first_name:text("child_first_name",80),birth_date:text("birth_date",40),parent1_name:text("parent1_name",80),parent2_name:text("parent2_name",80),
    parents_intro_enabled:s.parents_intro_enabled===true,parent1_photo_url:text("parent1_photo_url",2000),parent1_intro:text("parent1_intro",160),parent2_photo_url:text("parent2_photo_url",2000),parent2_intro:text("parent2_intro",160),parent1_phone:text("parent1_phone",80),parent2_phone:text("parent2_phone",80),person1_phone:text("person1_phone",80),host_phone:text("host_phone",80),host_name:text("host_name",80),person1_name:text("person1_name",80),event_title:text("event_title",160),manager_phone:text("manager_phone",80),manager_name:text("manager_name",80),host1_phone:text("host1_phone",80),host1_name:text("host1_name",80),host2_phone:text("host2_phone",80),host2_name:text("host2_name",80),
    groom_name:text("groom_name",80),groom_last_name:text("groom_last_name",80),groom_first_name:text("groom_first_name",80),bride_name:text("bride_name",80),bride_last_name:text("bride_last_name",80),bride_first_name:text("bride_first_name",80),groom_phone:text("groom_phone",80),bride_phone:text("bride_phone",80),
    groom_father_name:text("groom_father_name",80),groom_mother_name:text("groom_mother_name",80),bride_father_name:text("bride_father_name",80),bride_mother_name:text("bride_mother_name",80),groom_father_phone:text("groom_father_phone",80),groom_mother_phone:text("groom_mother_phone",80),bride_father_phone:text("bride_father_phone",80),bride_mother_phone:text("bride_mother_phone",80),
    event_date:text("event_date",40),event_time:text("event_time",40),venue:text("venue",200),venue_address:text("venue_address",500),venue_building:text("venue_building",200),venue_detail:text("venue_detail",200),
    transport_public_enabled:s.transport_public_enabled===true,transport_public:text("transport_public",2000),transport_car_enabled:s.transport_car_enabled===true,transport_car:text("transport_car",2000),transport_parking_enabled:s.transport_parking_enabled===true,transport_parking:text("transport_parking",2000),
    groom_bank:text("groom_bank",80),groom_account:text("groom_account",100),groom_account_holder:text("groom_account_holder",80),bride_bank:text("bride_bank",80),bride_account:text("bride_account",100),bride_account_holder:text("bride_account_holder",80),invitation_message:text("invitation_message",2000),
    rsvp_enabled:s.rsvp_enabled!==false,guestbook_enabled:s.guestbook_enabled!==false,notice_enabled:s.notice_enabled===true,notice_title:text("notice_title",80),notice_body:text("notice_body",3000),notice_image_url:text("notice_image_url",2000),
    gallery_images:Array.isArray(s.gallery_images)?s.gallery_images.filter(x=>typeof x==="string"&&x).slice(0,20).map(x=>x.slice(0,2000)):[],timeline_enabled:s.timeline_enabled===true,timeline_items:Array.isArray(s.timeline_items)?s.timeline_items.slice(0,6).map((item,index)=>({id:String(item?.id||`sample-${index+1}`).slice(0,100),date:String(item?.date||"").slice(0,40),text:String(item?.text||"").slice(0,80),photoUrl:String(item?.photoUrl||item?.photo_url||"").slice(0,2000)})):[]
  };
};
const fieldError=(b)=>{
  if(!b||typeof b!=="object")return "저장할 데이터를 확인해 주세요.";
  if(typeof b.name!=="string"||!b.name.trim())return "완성 템플릿 이름을 입력해 주세요.";
  if(typeof b.template_key!=="string"||!/^[a-z0-9][a-z0-9_-]{2,79}$/.test(b.template_key))return "Template key는 영문 소문자 또는 숫자로 시작하는 3~80자의 영문 소문자·숫자·-·_만 사용할 수 있어요.";
  if(!uuid.test(b.hero_preset_id||""))return "Hero 프리셋을 선택해 주세요.";
  if(!uuid.test(b.body_template_id||""))return "본문 테마를 선택해 주세요.";
  if(!Number.isInteger(Number(b.price))||Number(b.price)<0)return "가격은 0 이상의 정수로 입력해 주세요.";
  if(!Number.isInteger(Number(b.sort_order)))return "정렬 순서는 정수로 입력해 주세요.";
  return "완성 템플릿 정보를 확인해 주세요.";
};
const fields=(b)=>{
  if(!b||typeof b.name!=="string"||!b.name.trim()||typeof b.template_key!=="string"||!/^[a-z0-9][a-z0-9_-]{2,79}$/.test(b.template_key)||!uuid.test(b.hero_preset_id||"")||!uuid.test(b.body_template_id||""))return null;
  const price=Number(b.price),sort=Number(b.sort_order);
  if(!Number.isInteger(price)||price<0||!Number.isInteger(sort))return null;
  return {name:b.name.trim(),template_key:b.template_key,category:String(b.category||"wedding"),hero_preset_id:b.hero_preset_id,body_template_id:b.body_template_id,price,description:String(b.description||""),thumbnail_url:b.thumbnail_url||null,thumbnail_1_url:b.thumbnail_1_url||null,thumbnail_2_url:b.thumbnail_2_url||null,sample_content:cleanSampleContent(b.sample_content),is_visible:Boolean(b.is_visible),is_featured:Boolean(b.is_featured),sort_order:sort,updated_at:new Date().toISOString()};
};
export async function GET(request){
  const a=await getAdmin(request); if(a.error)return json({error:a.error},a.status);
  const [{data,error},{data:heroes},{data:bodies}]=await Promise.all([
    a.client.from("completed_templates").select("*").order("sort_order").order("created_at"),
    a.client.from("hero_presets").select("id,name,status,is_visible,event_kind").order("sort_order"),
    a.client.from("templates").select("id,name,status,is_visible,event_kind,current_sale_version_id").order("sort_order")
  ]);
  if(error)return json({error:"완성 템플릿 목록을 불러오지 못했어요."},500);
  return json({items:data||[],heroes:heroes||[],bodies:bodies||[]});
}
export async function POST(request){
  const a=await getAdmin(request); if(a.error)return json({error:a.error},a.status);
  const b=await request.json().catch(()=>null); const f=fields(b); if(!f)return json({error:fieldError(b)},400);
  const {updated_at,...insert}=f;
  const {error}=await a.client.from("completed_templates").insert({id:randomUUID(),...insert});
  if(error?.code==="23505")return json({error:"이미 사용 중인 template key예요."},409);
  if(error)return json({error:"완성 템플릿을 저장하지 못했어요."},500);
  return json({ok:true},201);
}
export async function PATCH(request){
  const a=await getAdmin(request); if(a.error)return json({error:a.error},a.status);
  const b=await request.json().catch(()=>null); if(!uuid.test(b?.id||""))return json({error:"완성 템플릿을 확인해 주세요."},400);
  const f=fields(b); if(!f)return json({error:fieldError(b)},400);
  const {error}=await a.client.from("completed_templates").update(f).eq("id",b.id);
  if(error)return json({error:"완성 템플릿을 수정하지 못했어요."},500);
  return json({ok:true});
}
