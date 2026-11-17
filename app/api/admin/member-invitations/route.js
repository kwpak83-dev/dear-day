import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getTemplateAssetReferences, resolveTemplateAssetUrls, applySaleTemplateStyles } from "../../../../lib/template-config";

const json=(data,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(request){
 const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return json({error:"로그인이 필요합니다."},401);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,pub=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key||!pub)return json({error:"관리자 설정이 필요합니다."},503);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await db.auth.getUser(token);
 if(authError||!user)return json({error:"로그인이 만료되었습니다."},401);
 const allowed=(process.env.DEARDAY_SUPER_ADMIN_IDS||"").split(",").map(v=>v.trim());
 if(!allowed.includes(user.id))return json({error:"접근 권한이 없습니다."},403);
 const adminDb=createClient(url,pub,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:isAdmin,error:adminError}=await adminDb.rpc("is_admin");
 if(adminError||isAdmin!==true)return json({error:"관리자 권한을 확인할 수 없습니다."},403);
 const params=new URL(request.url).searchParams;
 const eventId=params.get("eventId"),ownerId=params.get("ownerId");
 if(!uuid.test(eventId||"")||!uuid.test(ownerId||""))return json({error:"잘못된 초대장 또는 회원 ID입니다."},400);
 const {data:event,error:eventError}=await db.from("events").select("id,owner_id,slug,kind,status,template_id,template_version_id,hero_preset_id,cover_image_url,settings,updated_at,published_at").eq("id",eventId).eq("owner_id",ownerId).maybeSingle();
 if(eventError)return json({error:"초대장 조회에 실패했습니다."},503);
 if(!event)return json({error:"초대장을 찾을 수 없습니다."},404);
 // Durable audit is mandatory: do not expose private invitation content when logging is unavailable.
 const {error:auditError}=await db.from("admin_invitation_access_logs").insert({admin_id:user.id,owner_id:ownerId,event_id:event.id,action:"preview"});
 if(auditError){console.error("[admin invitation audit]",auditError.code);return json({error:"열람 기록을 저장할 수 없어 미리보기를 차단했습니다. 관리자 DB 설정을 확인해 주세요."},503);}
 let templateConfig=null,templateAssets={};
 if(event.template_id){
  let versionId=event.template_version_id;
  if(!versionId){
   const latest=await db.from("template_versions").select("id").eq("template_id",event.template_id).order("version",{ascending:false}).limit(1).maybeSingle();
   versionId=latest.data?.id;
  }
  if(versionId){
   const {data:version}=await db.from("template_versions").select("config").eq("id",versionId).eq("template_id",event.template_id).maybeSingle();
   templateConfig=version?.config||null;
   if(templateConfig){
    const {data:draft}=await db.from("template_versions").select("config").eq("template_id",event.template_id).eq("status","draft").order("version",{ascending:false}).limit(1).maybeSingle();
    if(draft?.config)templateConfig=applySaleTemplateStyles(templateConfig,draft.config);
    const refs=getTemplateAssetReferences(templateConfig);
    if(refs.length){
     const {data:assets,error:assetError}=await db.from("template_assets").select("id,template_id,asset_type,storage_bucket,storage_path").eq("template_id",event.template_id).in("id",refs.map(ref=>ref.id));
     if(assetError)return json({error:"템플릿 이미지 정보를 불러오지 못했습니다."},503);
     templateAssets=resolveTemplateAssetUrls(templateConfig,assets||[],event.template_id,asset=>db.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl);
    }
   }
  }
 }
 const {data:galleryRows,error:galleryError}=await db.from("event_media").select("id,storage_path,gallery_thumbnail_path").eq("event_id",event.id).eq("gallery_state","ready").order("sort_order").order("id").limit(20);
 let gallery=galleryRows||[];
 if(galleryError?.code==="42703"||galleryError?.code==="PGRST204"){
  const fallback=await db.from("event_media").select("id,storage_path").eq("event_id",event.id).eq("gallery_state","ready").order("sort_order").order("id").limit(20);
  if(fallback.error)return json({error:"갤러리 사진 조회에 실패했습니다."},503);
  gallery=fallback.data||[];
 }else if(galleryError)return json({error:"갤러리 사진 조회에 실패했습니다."},503);
 const galleryPhotos=gallery.map(row=>({id:row.id,url:db.storage.from("invitation-photos").getPublicUrl(row.storage_path).data.publicUrl,thumbnailUrl:row.gallery_thumbnail_path?db.storage.from("invitation-photos").getPublicUrl(row.gallery_thumbnail_path).data.publicUrl:null}));
 const {data:eventTypeConfig}=await db.from("event_type_configs").select("kind,label,fields").eq("kind",event.kind).maybeSingle();
 if(event.hero_preset_id){
  const [{data:heroPreset},{data:heroAssets}]=await Promise.all([
   db.from("hero_presets").select("config").eq("id",event.hero_preset_id).maybeSingle(),
   db.from("hero_preset_assets").select("id,asset_type,storage_bucket,storage_path").eq("hero_preset_id",event.hero_preset_id).in("asset_type",["hero_frame","hero_background"]).eq("is_active",true)
  ]);
  if(heroPreset?.config){
   const settings=event.settings||{};
   const frame=heroAssets?.find(a=>a.asset_type==="hero_frame");
   const background=heroAssets?.find(a=>a.asset_type==="hero_background");
   const layers=[...(heroPreset.config.decorLayers||[]),...(templateConfig?.decorations||[])];
   const ids=new Set(layers.map(l=>l.assetId).filter(Boolean));
   const decorationPaths=new Map(layers.flatMap(l=>typeof l.assetId==="string"&&typeof l.assetPath==="string"&&l.assetPath.startsWith("hero-decoration-library/")?[[l.assetId,l.assetPath]]:[]));
   if([...ids].some(id=>!decorationPaths.has(id))){
    const {data:files}=await db.storage.from("template-assets").list("hero-decoration-library",{limit:1000});
    for(const file of files||[]){const id=file.name.split(".")[0];if(ids.has(id)&&!decorationPaths.has(id))decorationPaths.set(id,"hero-decoration-library/"+file.name);}
   }
   templateConfig={...(templateConfig||{}),hero:{...(templateConfig?.hero||{}),...heroPreset.config,intro:{...(heroPreset.config.intro||{}),...(settings.heroIntroOverrides||{})},textLayers:[...(heroPreset.config.textLayers||[]),...(Array.isArray(settings.heroExtraTextLayers)?settings.heroExtraTextLayers.slice(0,20):[])].map(l=>({...l,...(settings.heroLayerOverrides?.[l.id]||{}),text:typeof settings.heroTextOverrides?.[l.id]==="string"?settings.heroTextOverrides[l.id].slice(0,200):l.text})),frameAssetId:frame?.id||null,backgroundAssetId:background?.id||null}};
   for(const [id,path] of decorationPaths)templateAssets[id]=db.storage.from("template-assets").getPublicUrl(path).data.publicUrl;
   for(const l of layers){if(typeof l.assetId==="string"&&l.mobileAssetPath===`hero-decoration-library/${l.assetId}-mobile.webp`)templateAssets[l.assetId+":mobile"]=db.storage.from("template-assets").getPublicUrl(l.mobileAssetPath).data.publicUrl;}
   for(const asset of [frame,background])if(asset)templateAssets[asset.id]=db.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl;
  }
 }
 return json({event:{id:event.id,slug:event.slug,kind:event.kind,status:event.status,updatedAt:event.updated_at,publishedAt:event.published_at,templateId:event.template_id,heroPresetId:event.hero_preset_id,invitation:{...(event.settings||{}),eventKind:event.kind,templateId:event.template_id,heroPresetId:event.hero_preset_id,coverPhotoUrl:event.settings?.coverPhotoUrl||event.settings?.coverPhoto||event.cover_image_url||""}},templateConfig,templateAssets,galleryPhotos,eventTypeConfig});
}
