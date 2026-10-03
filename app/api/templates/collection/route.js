import { createClient } from "@supabase/supabase-js";
export async function GET(request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return Response.json({items:[]});
 const params=new URL(request.url).searchParams,category=params.get("category"),featured=params.get("featured")==="1";
 const supabase=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 let q=supabase.from("completed_templates").select("id,name,template_key,category,price,description,thumbnail_1_url,thumbnail_2_url,hero_preset_id,body_template_id,sort_order,is_visible,is_featured").order("sort_order").order("created_at");
 if(featured)q=q.eq("is_featured",true);else q=q.eq("is_visible",true);
 if(category)q=q.eq("category",category);
 const {data,error}=await q;if(error)return Response.json({items:[]},{status:500});
 return Response.json({items:data||[]});
}