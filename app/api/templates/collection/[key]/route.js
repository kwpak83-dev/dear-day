import { createClient } from "@supabase/supabase-js";
import { resolveTemplateAssetUrls } from "../../../../../lib/template-config";
const configOf=d=>d?({decorations:d.decorations,background:d.background,hero:d.hero,typography:d.typography,colors:d.colors,buttonStyle:d.buttonStyle,quickMenu:d.quickMenu,sections:d.sections,effects:d.effects,bgm:d.bgm,safeArea:d.safeArea}):null;
export async function GET(_request,{params}){
 const {key}=await params,url=process.env.NEXT_PUBLIC_SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!service)return Response.json({error:"템플릿 서비스를 준비하지 못했어요."},{status:503});
 const s=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:item,error}=await s.from("completed_templates").select("*").eq("template_key",key).eq("is_visible",true).maybeSingle();
 if(error||!item)return Response.json({error:"템플릿을 찾지 못했어요."},{status:404});
 const [{data:hero},{data:heroAssets},{data:versions},{data:bodyAssets}]=await Promise.all([
  s.from("hero_presets").select("id,name,config").eq("id",item.hero_preset_id).maybeSingle(),
  s.from("hero_preset_assets").select("id,asset_type,storage_bucket,storage_path,is_active").eq("hero_preset_id",item.hero_preset_id).eq("is_active",true),
  s.from("template_versions").select("config,status,version").eq("template_id",item.body_template_id).order("version",{ascending:false}),
  s.from("template_assets").select("id,template_id,asset_type,storage_bucket,storage_path,is_active").eq("template_id",item.body_template_id).eq("is_active",true)
 ]);
 const version=(versions||[]).find(x=>x.status==="draft")||(versions||[]).find(x=>x.status==="active")||versions?.[0],base=configOf(version?.config);
 if(!hero||!base)return Response.json({error:"템플릿 미리보기를 준비하지 못했어요."},{status:409});
 const frame=(heroAssets||[]).find(x=>x.asset_type==="hero_frame"),config={...base,hero:{...base.hero,...hero.config,frameAssetId:frame?.id||null}};
 const assets=resolveTemplateAssetUrls(config,bodyAssets||[],item.body_template_id,(asset)=>asset?.storage_bucket&&asset?.storage_path?s.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl:null);
 if(frame?.storage_bucket&&frame?.storage_path)assets[frame.id]=s.storage.from(frame.storage_bucket).getPublicUrl(frame.storage_path).data.publicUrl;
 return Response.json({item:{id:item.id,name:item.name,template_key:item.template_key,category:item.category,price:item.price,description:item.description,hero_preset_id:item.hero_preset_id,body_template_id:item.body_template_id},templateConfig:config,templateAssets:assets});
}