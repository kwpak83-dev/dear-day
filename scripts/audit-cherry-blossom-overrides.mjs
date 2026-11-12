#!/usr/bin/env node
/**
 * Read-only audit of the effective Cherry Blossom Day sample.
 * Run: node --env-file=.env.local scripts/audit-cherry-blossom-overrides.mjs
 * Never changes Supabase data.
 */
import { createClient } from "@supabase/supabase-js";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error("Missing Supabase environment variables");
const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
const [{data:template,error:e1},{data:defaults,error:e2}]=await Promise.all([
 db.from("completed_templates").select("id,template_key,category,sample_content").eq("template_key","cherry-blossom-day").maybeSingle(),
 db.from("completed_template_sample_defaults").select("sample_content").eq("id","wedding").maybeSingle()
]);
if(e1||e2||!template||!defaults) throw e1||e2||new Error("Template/defaults missing");
const own=template.sample_content||{}, common=defaults.sample_content||{};
const effective={...common,...own,gallery_images:Array.isArray(own.gallery_images)&&own.gallery_images.length?own.gallery_images:(common.gallery_images||[])};
const walk=(node, prefix="", results=[])=>{
 if(typeof node==="string" && /\/storage\/v1\/object\/public\//.test(node) && /\.(png|webp)(?:[?#]|$)/i.test(node)) results.push({field:prefix,format:/\.png(?:[?#]|$)/i.test(node)?"PNG":"WebP",url:node});
 else if(Array.isArray(node)) node.forEach((v,i)=>walk(v,`${prefix}[${i}]`,results));
 else if(node&&typeof node==="object") Object.entries(node).forEach(([k,v])=>walk(v,prefix?`${prefix}.${k}`:k,results));
 return results;
};
const entries=walk(effective);
console.log("Template:",template.template_key,"id:",template.id);
console.log("Effective image references:",entries.length);
for(const x of entries) {
 const ownTop=Object.prototype.hasOwnProperty.call(own,x.field.split(/[.[]/)[0]);
 console.log(`[${x.format}] [${ownTop?"template override":"wedding default"}] ${x.field}\n  ${x.url}`);
}
console.log("PNG:",entries.filter(x=>x.format==="PNG").length,"WebP:",entries.filter(x=>x.format==="WebP").length);
console.log("READ ONLY. No DB or Storage changes.");
