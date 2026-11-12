#!/usr/bin/env node
/**
 * Cherry Blossom Day only: audit and optionally migrate existing PNG image URLs
 * to already-uploaded WebP assets from the verified conversion manifest.
 *
 * Dry run:
 * node --env-file=.env.local scripts/apply-cherry-blossom-webp.mjs
 * Apply (changes only completed_templates.sample_content for cherry-blossom-day):
 * node --env-file=.env.local scripts/apply-cherry-blossom-webp.mjs --apply --confirm-cherry-blossom
 * Roll back using the generated backup:
 * node --env-file=.env.local scripts/apply-cherry-blossom-webp.mjs --rollback --confirm-cherry-blossom
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const argv=process.argv.slice(2), has=x=>argv.includes(x);
const arg=(key,fallback)=>{const i=argv.indexOf(key);return i<0?fallback:argv[i+1];};
const mode=has("--rollback")?"rollback":has("--apply")?"apply":"dry-run";
if(has("--rollback")&&has("--apply"))throw Error("Choose one mode");
if(mode!=="dry-run"&&!has("--confirm-cherry-blossom"))throw Error("Explicit --confirm-cherry-blossom required");
const manifestPath=path.resolve(arg("--manifest",".landing-webp-preview/manifest.json"));
const backupPath=path.resolve(arg("--backup",".landing-webp-preview/cherry-blossom-sample-backup.json"));
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error("Missing Supabase credentials");
const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
const {data:row,error:readError}=await db.from("completed_templates").select("id,template_key,sample_content").eq("template_key","cherry-blossom-day").maybeSingle();
if(readError||!row)throw readError||Error("Template not found");
const current=row.sample_content||{};
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const replace=(x,map)=>typeof x==="string"?(map.get(x)||x):Array.isArray(x)?x.map(v=>replace(v,map)):x&&typeof x==="object"?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,replace(v,map)])):x;
const count=(x,target)=>typeof x==="string"?Number(x===target):Array.isArray(x)?x.reduce((n,v)=>n+count(v,target),0):x&&typeof x==="object"?Object.values(x).reduce((n,v)=>n+count(v,target),0):0;
if(mode==="rollback"){
 const backup=JSON.parse(await fs.readFile(backupPath,"utf8"));
 if(backup.template_key!=="cherry-blossom-day"||backup.id!==row.id||!backup.sample_content||!backup.afterHash||!backup.beforeHash)throw Error("Invalid backup");
 if(hash(current)!==backup.afterHash)throw Error("Sample changed since apply; refusing rollback");
 const {error}=await db.from("completed_templates").update({sample_content:backup.sample_content}).eq("id",row.id).eq("template_key","cherry-blossom-day");
 if(error)throw error;
 console.log("Restored Cherry Blossom Day sample. No Storage files deleted.");
 process.exit(0);
}
const manifest=JSON.parse(await fs.readFile(manifestPath,"utf8"));
if(manifest.template!=="cherry-blossom-day"||!Array.isArray(manifest.images))throw Error("Unexpected manifest");
const entries=manifest.images.filter(x=>x.selected);
if(entries.length!==17)throw Error("Expected 17 selected images; got "+entries.length);
const mapping=new Map();
const storagePrefix="/storage/v1/object/public/template-assets/";
for(const entry of entries){
 const source=new URL(entry.originalUrl);
 if(source.origin!==new URL(url).origin||!source.pathname.startsWith(storagePrefix)||!source.pathname.endsWith(".png"))throw Error("Invalid original URL");
 const storagePath=decodeURIComponent(source.pathname.slice(storagePrefix.length)).replace(/\.png$/i,".webp");
 const webpUrl=db.storage.from("template-assets").getPublicUrl(storagePath).data.publicUrl;
 if(mapping.has(entry.originalUrl))throw Error("Duplicate URL in manifest");
 mapping.set(entry.originalUrl,webpUrl);
}
const missing=entries.filter(x=>count(current,x.originalUrl)===0);
if(missing.length)throw Error("Template changed or manifest mismatch; missing PNG URLs: "+missing.map(x=>x.field).join(", "));
const next=replace(current,mapping);
const beforeHash=hash(current),afterHash=hash(next);
console.log("Template:",row.template_key,"matched image URLs:",entries.length,"references:",entries.reduce((n,x)=>n+count(current,x.originalUrl),0));
console.log("Mode:",mode);
if(mode==="dry-run"){
 console.log("DRY RUN only. No DB or Storage changes.");
 process.exit(0);
}
for(const entry of entries){
 const target=mapping.get(entry.originalUrl);
 const response=await fetch(target,{method:"HEAD",signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error("WebP missing: "+entry.field+" ("+response.status+")");
 const size=Number(response.headers.get("content-length"));
 if(size&&size!==entry.webpBytes)throw Error("WebP size mismatch: "+entry.field);
 const type=response.headers.get("content-type")||"";
 if(type&&!type.toLowerCase().includes("image/webp"))throw Error("Unexpected content type: "+entry.field+" "+type);
}
await fs.mkdir(path.dirname(backupPath),{recursive:true});
try{await fs.stat(backupPath);throw Error("Backup exists; refusing overwrite");}
catch(e){if(e.code!=="ENOENT")throw e;}
const backup={template_key:row.template_key,id:row.id,createdAt:new Date().toISOString(),beforeHash,afterHash,sample_content:current};
await fs.writeFile(backupPath,JSON.stringify(backup,null,2),{flag:"wx",mode:0o600});
const {data:latest,error:latestError}=await db.from("completed_templates").select("sample_content").eq("id",row.id).maybeSingle();
if(latestError||hash(latest?.sample_content||{})!==beforeHash)throw Error("Concurrent modification detected; refusing apply");
const {error}=await db.from("completed_templates").update({sample_content:next}).eq("id",row.id).eq("template_key","cherry-blossom-day");
if(error)throw error;
console.log("Updated Cherry Blossom Day 17 image URLs. Backup:",backupPath);
console.log("To undo: node --env-file=.env.local scripts/apply-cherry-blossom-webp.mjs --rollback --confirm-cherry-blossom");
