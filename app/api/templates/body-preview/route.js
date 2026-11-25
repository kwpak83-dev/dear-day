import { createClient } from "@supabase/supabase-js";
import { applySaleTemplateStyles, resolveTemplateAssetUrls } from "../../../../lib/template-config";

export async function GET(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return Response.json({error:"미리보기를 준비하지 못했어요."},{status:503});
 const s=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:item,error}=await s.from("templates").select("id,current_sale_version_id").eq("template_key","basic_photo1").eq("status","on_sale").eq("is_visible",true).maybeSingle();
 if(error||!item)return Response.json({error:"기본형을 찾지 못했어요."},{status:404});
 const [{data:versions,error:ve},{data:assets,error:ae}]=await Promise.all([
 s.from("template_versions").select("id,config,status,version").eq("template_id",item.id).order("version",{ascending:false}),
 s.from("template_assets").select("id,template_id,asset_type,storage_bucket,storage_path,is_active").eq("template_id",item.id).eq("is_active",true)]);
 const sale=versions?.find(v=>v.id===item.current_sale_version_id)||versions?.find(v=>v.status==="active");
 if(ve||ae||!sale?.config)return Response.json({error:"기본형 설정을 불러오지 못했어요."},{status:409});
 const draft=versions.find(v=>v.status==="draft");
 const visual=draft?.config?applySaleTemplateStyles(sale.config,draft.config):sale.config;
 const config=Object.fromEntries(["background","typography","colors","sections","decorations","safeArea","buttonStyle"].filter(k=>visual[k]!=null).map(k=>[k,visual[k]]));
 const resolved=resolveTemplateAssetUrls(config,assets||[],item.id,a=>a.storage_bucket&&a.storage_path?s.storage.from(a.storage_bucket).getPublicUrl(a.storage_path).data.publicUrl:null);
 return Response.json({templateId:item.id,templateConfig:config,templateAssets:resolved},{headers:{"Cache-Control":"no-store"}});
}
