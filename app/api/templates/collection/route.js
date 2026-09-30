import { createClient } from "@supabase/supabase-js";
export async function GET(request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return Response.json({items:[]});
 const category=new URL(request.url).searchParams.get("category");
 const supabase=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 let q=supabase.from("completed_templates").select("id,name,template_key,category,price,description,thumbnail_1_url,thumbnail_2_url,hero_preset_id,body_template_id,sort_order").eq("is_visible",true).order("sort_order").order("created_at");
 if(category)q=q.eq("category",category);
 const {data,error}=await q;if(error)return Response.json({items:[]},{status:500});
 return Response.json({items:data||[]});
}