import { createClient } from "@supabase/supabase-js";
import { resolveTemplateAssetUrls } from "../../../../../lib/template-config";
const configOf=d=>d?({decorations:d.decorations,background:d.background,hero:d.hero,typography:d.typography,colors:d.colors,buttonStyle:d.buttonStyle,quickMenu:d.quickMenu,sections:d.sections,effects:d.effects,bgm:d.bgm,safeArea:d.safeArea}):null;
export async function GET(_request,{params}){
 const {key}=await params,url=process.env.NEXT_PUBLIC_SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!service)return Response.json({error:"템플릿 서비스를 준비하지 못했어요."},{status:503});
 const s=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:item,error}=await s.from("completed_templates").select("*").eq("template_key",key).or("is_visible.eq.true,is_featured.eq.true").maybeSingle();
 if(error||!item)return Response.json({error:"템플릿을 찾지 못했어요."},{status:404});
 const [{data:hero},{data:heroAssets},{data:versions},{data:bodyAssets},{data:defaults}]=await Promise.all([
  s.from("hero_presets").select("id,name,config").eq("id",item.hero_preset_id).maybeSingle(),
  s.from("hero_preset_assets").select("id,asset_type,storage_bucket,storage_path,is_active").eq("hero_preset_id",item.hero_preset_id).eq("is_active",true),
  s.from("template_versions").select("config,status,version").eq("template_id",item.body_template_id).order("version",{ascending:false}),
  s.from("template_assets").select("id,template_id,asset_type,storage_bucket,storage_path,is_active").eq("template_id",item.body_template_id).eq("is_active",true),
  s.from("completed_template_sample_defaults").select("sample_content").eq("id","default").maybeSingle()
 ]);
 const version=(versions||[])[0],base=configOf(version?.config);
 if(!hero||!base)return Response.json({error:"템플릿 미리보기를 준비하지 못했어요."},{status:409});
 const frame=(heroAssets||[]).find(x=>x.asset_type==="hero_frame"),config={...base,hero:{...base.hero,...hero.config,frameAssetId:frame?.id||null}};
 const assets=resolveTemplateAssetUrls(config,bodyAssets||[],item.body_template_id,(asset)=>asset?.storage_bucket&&asset?.storage_path?s.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl:null);
 const decorIds=new Set([...(hero.config?.decorLayers||[]).map(layer=>layer?.assetId),...(config?.decorations||[]).map(item=>item?.assetId)].filter(Boolean));
 if(decorIds.size){const listed=await s.storage.from("template-assets").list("hero-decoration-library",{limit:1000});if(!listed.error)for(const file of listed.data||[]){const id=file.name.split(".")[0];if(decorIds.has(id))assets[id]=s.storage.from("template-assets").getPublicUrl(`hero-decoration-library/${file.name}`).data.publicUrl;}}
 if(frame?.storage_bucket&&frame?.storage_path){const heroPhotoUrl=s.storage.from(frame.storage_bucket).getPublicUrl(frame.storage_path).data.publicUrl;assets[frame.id]=heroPhotoUrl;assets.heroPhotoUrl=heroPhotoUrl;}
 const own=item.sample_content&&typeof item.sample_content==="object"?item.sample_content:{},fallback=defaults?.sample_content&&typeof defaults.sample_content==="object"?defaults.sample_content:{},sampleContent={...fallback,...own,gallery_images:Array.isArray(own.gallery_images)&&own.gallery_images.length?own.gallery_images:(fallback.gallery_images||[])};
 return Response.json({item:{id:item.id,name:item.name,template_key:item.template_key,category:item.category,price:item.price,description:item.description,hero_preset_id:item.hero_preset_id,body_template_id:item.body_template_id,sample_content:sampleContent},templateConfig:config,templateAssets:assets});
}