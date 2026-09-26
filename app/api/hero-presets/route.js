import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const json=(body,status=200)=>NextResponse.json(body,{status});
export async function GET(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return json({error:"Hero 서비스를 준비하지 못했어요."},503);
 const client=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data,error}=await client.from("hero_presets").select("id,name,description,config,sort_order").eq("status","on_sale").eq("is_visible",true).order("sort_order",{ascending:true});
 if(error)return json({error:"Hero 목록을 불러오지 못했어요."},500);
 const ids=(data||[]).map(x=>x.id);
 let assets=[];
 if(ids.length){const result=await client.from("hero_preset_assets").select("id,hero_preset_id,asset_type,storage_bucket,storage_path").in("hero_preset_id",ids).eq("is_active",true);if(result.error)return json({error:"Hero 이미지를 불러오지 못했어요."},500);assets=result.data||[];}
 const byPreset={};
 for(const asset of assets){(byPreset[asset.hero_preset_id]??={})[asset.asset_type]={id:asset.id,url:client.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl};}
 return json({presets:(data||[]).map(p=>({...p,assets:byPreset[p.id]||{}}))});
}