import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const json = (body, status = 200) => NextResponse.json(body, { status });
const statuses = new Set(["draft", "on_sale", "stopped"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const heroModes = new Set(["photo", "frame", "illustration"]);
const heroRatios = new Set(["4:5", "1:1", "3:4", "16:9"]);
const heroDisplayKeys = ["eyebrow","eventLabel","title","relations","detail","note","schedule","venue"];
const defaultDisplay = Object.fromEntries(heroDisplayKeys.map((key) => [key, true]));
const defaultConfig = { mode:"photo", aspectRatio:"4:5", positionX:50, positionY:50, textYPercent:50, scheduleFontSize:11, nameFontSize:21, nameFontFamily:"inherit", nameFontWeight:400, nameLineHeight:1.5, nameLetterSpacing:0, nameTextAlign:"center", nameColor:"#ffffff", separatorFontSize:16, separatorColor:"#d8b985", zoom:1, overlayColor:"#000000", overlayOpacity:0, headerVisible:true, mastheadVisible:true, mastheadText:"", display:defaultDisplay };

async function getAdmin(request) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!url||!publishableKey||!serviceRoleKey) return {error:"관리자 서비스를 준비하지 못했어요.",status:503};
  if(!token) return {error:"로그인이 필요합니다.",status:401};
  const serverClient=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error}=await serverClient.auth.getUser(token);
  if(error||!user) return {error:"로그인이 만료되었습니다.",status:401};
  const adminClient=createClient(url,publishableKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{autoRefreshToken:false,persistSession:false}});
  const {data:isAdmin,error:adminError}=await adminClient.rpc("is_admin");
  if(adminError) return {error:"관리자 권한을 확인하지 못했어요.",status:500};
  if(isAdmin!==true) return {error:"관리자만 접근할 수 있습니다.",status:403};
  return {serverClient};
}
const decimal=(value,min,max)=>typeof value==="number"&&Number.isFinite(value)&&value>=min&&value<=max;
const hex=(value)=>typeof value==="string"&&/^#[0-9a-fA-F]{6}$/.test(value);
function validConfig(value){
  if(!value||typeof value!=="object"||Array.isArray(value)) return false;
  const allowed=["mode","aspectRatio","positionX","positionY","textYPercent","scheduleFontSize","nameFontSize","nameFontFamily","nameFontWeight","nameLineHeight","nameLetterSpacing","nameTextAlign","nameColor","separatorFontSize","separatorColor","zoom","overlayColor","overlayOpacity","headerVisible","mastheadVisible","mastheadText","display","textLayers"];
  if(Object.keys(value).some((key)=>!allowed.includes(key))) return false;
  const baseValid=heroModes.has(value.mode)&&heroRatios.has(value.aspectRatio)
    &&decimal(value.positionX,0,100)&&decimal(value.positionY,0,100)
    &&decimal(value.textYPercent,0,100)&&Number.isInteger(value.scheduleFontSize)
    &&decimal(value.scheduleFontSize,8,24)
    &&(value.nameFontSize===undefined||Number.isInteger(value.nameFontSize)&&decimal(value.nameFontSize,8,72))
    &&(value.nameFontFamily===undefined||value.nameFontFamily==="inherit"||fontIds.has(value.nameFontFamily))
    &&(value.nameFontWeight===undefined||[300,400,500,600,700,800].includes(value.nameFontWeight))
    &&(value.nameLineHeight===undefined||decimal(value.nameLineHeight,.8,2.5))
    &&(value.nameLetterSpacing===undefined||decimal(value.nameLetterSpacing,-5,15))
    &&(value.nameTextAlign===undefined||["left","center","right"].includes(value.nameTextAlign))
    &&(value.nameColor===undefined||hex(value.nameColor))
    &&(value.separatorFontSize===undefined||Number.isInteger(value.separatorFontSize)&&decimal(value.separatorFontSize,8,72))
    &&(value.separatorColor===undefined||hex(value.separatorColor))
    &&decimal(value.zoom,.5,2)
    &&hex(value.overlayColor)&&decimal(value.overlayOpacity,0,1)
    &&typeof value.headerVisible==="boolean"&&typeof value.mastheadVisible==="boolean"
    &&typeof value.mastheadText==="string"&&value.mastheadText.length<=60
    &&value.display&&typeof value.display==="object"&&!Array.isArray(value.display)
    &&Object.keys(value.display).length===heroDisplayKeys.length
    &&heroDisplayKeys.every((key)=>typeof value.display[key]==="boolean");
  if(!baseValid)return false;
  if(value.textLayers===undefined)return true;
  if(!Array.isArray(value.textLayers)||value.textLayers.length>12)return false;

  return value.textLayers.every((layer)=>layer&&typeof layer==="object"&&!Array.isArray(layer)
    &&Object.keys(layer).every((key)=>["id","text","fontId","fontSize","color","x","y","align"].includes(key))
    &&typeof layer.id==="string"&&/^[a-zA-Z0-9_-]{1,80}$/.test(layer.id)
    &&typeof layer.text==="string"&&layer.text.length<=200
    &&typeof layer.fontId==="string"&&fontIds.has(layer.fontId)
    &&(layer.fontSize===undefined||Number.isInteger(layer.fontSize)&&decimal(layer.fontSize,8,100))
    &&(layer.color===undefined||hex(layer.color))
    &&(layer.x===undefined||decimal(layer.x,0,100))
    &&(layer.y===undefined||decimal(layer.y,0,100))
    &&(layer.align===undefined||["left","center","right"].includes(layer.align)))
    &&new Set(value.textLayers.map((layer)=>layer.id)).size===value.textLayers.length;
}
function fields(body){
  if(!body||typeof body!=="object"||Array.isArray(body)) return null;
  const {name,preset_key,description,status,is_visible,sort_order,config}=body;
  if(typeof name!=="string"||!name.trim()||name.trim().length>100) return null;
  if(typeof preset_key!=="string"||!/^[a-z0-9][a-z0-9_-]{2,79}$/.test(preset_key.trim())) return null;
  if(typeof description!=="string"||description.length>2000||!statuses.has(status)||typeof is_visible!=="boolean"||!Number.isInteger(sort_order)||sort_order < -10000||sort_order > 10000||!validConfig(config)) return null;
  return {name:name.trim(),preset_key:preset_key.trim(),description:description.trim(),status,is_visible,sort_order,config};
}
export async function GET(request){
  const auth=await getAdmin(request); if(auth.error) return json({error:auth.error},auth.status);
  const {data,error}=await auth.serverClient.from("hero_presets").select("id,name,preset_key,description,status,is_visible,sort_order,config,created_at,updated_at").order("sort_order").order("created_at");
  if(error){ console.error("Hero preset list failed", { code:error.code, message:error.message, details:error.details, hint:error.hint }); return json({error:`Hero 프리셋 목록 오류: ${error.message}`},500); }
  return json({presets:data||[]});
}
export async function POST(request){
  const auth=await getAdmin(request); if(auth.error) return json({error:auth.error},auth.status);
  const value=fields(await request.json().catch(()=>null)); if(!value) return json({error:"Hero 프리셋 정보를 확인해 주세요."},400);
  const id=randomUUID(); const {error}=await auth.serverClient.from("hero_presets").insert({id,...value});
  if(error?.code==="23505") return json({error:"이미 사용 중인 preset key예요."},409);
  if(error) return json({error:"Hero 프리셋을 등록하지 못했어요."},500);
  return json({id},201);
}
export async function PATCH(request){
  const auth=await getAdmin(request); if(auth.error) return json({error:auth.error},auth.status);
  const body=await request.json().catch(()=>null); if(!uuid.test(body?.id||"")) return json({error:"Hero 프리셋 정보가 올바르지 않아요."},400);
  const value=fields(body); if(!value) return json({error:"Hero 프리셋 정보를 확인해 주세요."},400);
  const {data:existing,error:lookup}=await auth.serverClient.from("hero_presets").select("id,preset_key").eq("id",body.id).maybeSingle();
  if(lookup) return json({error:"Hero 프리셋을 확인하지 못했어요."},500); if(!existing) return json({error:"Hero 프리셋을 찾지 못했어요."},404);
  if(existing.preset_key!==value.preset_key) return json({error:"기존 preset key는 변경할 수 없어요."},400);
  const {preset_key:_key,...updates}=value; updates.updated_at=new Date().toISOString();
  const {error,count}=await auth.serverClient.from("hero_presets").update(updates,{count:"exact"}).eq("id",body.id);
  if(error||count!==1) return json({error:"Hero 프리셋을 수정하지 못했어요."},500);
  return json({id:body.id});
}
export { defaultConfig };
function replace() { [native code] }