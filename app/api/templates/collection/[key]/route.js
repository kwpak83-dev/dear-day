import { completedTemplateCategoryToEventKind, mergeCompletedTemplateSamples } from "../../../../../lib/completed-template-sample";
import { createClient } from "@supabase/supabase-js";
import { applySaleTemplateStyles, resolveTemplateAssetUrls } from "../../../../../lib/template-config";
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
  s.from("template_assets").select("id,template_id,asset_type,storage_bucket,storage_path,is_active").eq("template_id",item.body_template_id),
  s.from("completed_template_sample_defaults").select("sample_content").eq("id",completedTemplateCategoryToEventKind(item.category)).maybeSingle()
 ]);
 const version=(versions||[])[0],draft=(versions||[]).find(v=>v.status==="draft");
 const base=configOf(version?.config);
 const visualConfig=draft?.config?applySaleTemplateStyles(base,draft.config):base;
 // Match the working admin completed-template preview: use the saved Draft BGM directly.
 // A pinned sale version may have no BGM even when the latest Draft has one.
 if(visualConfig && draft?.config && Object.hasOwn(draft.config,"bgm")) visualConfig.bgm=draft.config.bgm;
 if(!hero||!base)return Response.json({error:"템플릿 미리보기를 준비하지 못했어요."},{status:409});
 const frame=(heroAssets||[]).find(x=>x.asset_type==="hero_frame"),background=(heroAssets||[]).find(x=>x.asset_type==="hero_background"),config={...visualConfig,hero:{...base.hero,...hero.config,frameAssetId:frame?.id||null,backgroundAssetId:background?.id||null}};
 const assets=resolveTemplateAssetUrls(config,(bodyAssets||[]).filter(asset=>asset.is_active),item.body_template_id,(asset)=>asset?.storage_bucket&&asset?.storage_path?s.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl:null);
 // Resolve the selected audio asset using the same public URL source as the admin preview.
 const bgmId=config.bgm?.mode==="asset"?config.bgm.assetId:null;
 if(bgmId && !assets[bgmId]) {
  const audio=(bodyAssets||[]).find(asset=>asset.id===bgmId&&asset.asset_type==="bgm"&&asset.is_active&&asset.storage_bucket==="template-assets"&&asset.storage_path?.startsWith(`${item.body_template_id}/`));
  if(audio) assets[bgmId]=s.storage.from("template-assets").getPublicUrl(audio.storage_path).data.publicUrl;
 }
 const decorIds=new Set([...(hero.config?.decorLayers||[]).map(layer=>layer?.assetId),...(config?.decorations||[]).map(item=>item?.assetId)].filter(Boolean));
 if(decorIds.size){const listed=await s.storage.from("template-assets").list("hero-decoration-library",{limit:1000});if(!listed.error)for(const file of listed.data||[]){const id=file.name.split(".")[0];if(decorIds.has(id))assets[id]=s.storage.from("template-assets").getPublicUrl(`hero-decoration-library/${file.name}`).data.publicUrl;}}
 if(frame?.storage_bucket&&frame?.storage_path){const heroPhotoUrl=s.storage.from(frame.storage_bucket).getPublicUrl(frame.storage_path).data.publicUrl;assets[frame.id]=heroPhotoUrl;assets.heroPhotoUrl=heroPhotoUrl;}
 if(background?.storage_bucket&&background?.storage_path){assets[background.id]=s.storage.from(background.storage_bucket).getPublicUrl(background.storage_path).data.publicUrl;}
 const own=item.sample_content&&typeof item.sample_content==="object"?item.sample_content:{},fallback=defaults?.sample_content&&typeof defaults.sample_content==="object"?defaults.sample_content:{},sampleContent={...mergeCompletedTemplateSamples(fallback,own),gallery_images:Array.isArray(own.gallery_images)&&own.gallery_images.length?own.gallery_images:(fallback.gallery_images||[])};
 return Response.json({item:{id:item.id,name:item.name,template_key:item.template_key,category:item.category,price:item.price,description:item.description,thumbnail_1_url:item.thumbnail_1_url||null,thumbnail_2_url:item.thumbnail_2_url||null,hero_preset_id:item.hero_preset_id,body_template_id:item.body_template_id,sample_content:sampleContent},templateConfig:config,templateAssets:assets},{headers:{"Cache-Control":"no-store"}});
}
