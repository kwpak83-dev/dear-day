import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

function cronAuthorized(request) {
  const secret=process.env.CRON_SECRET;
  if(!secret)return false;
  const supplied=Buffer.from(request.headers.get("authorization")||"");
  const expected=Buffer.from(`Bearer ${secret}`);
  return supplied.length===expected.length && timingSafeEqual(supplied,expected);
}

// Observability is best-effort: logging must never block the deletion worker.
export async function withRetentionRunLog(task,request,handler) {
  if(!cronAuthorized(request))return handler(request);
  const startedAt=new Date().toISOString();
  let response;
  try { response=await handler(request); }
  catch(error){
    await record(task,startedAt,500,{error:"Unhandled worker exception"});
    throw error;
  }
  let report={};
  try { report=await response.clone().json(); } catch {}
  await record(task,startedAt,response.status,report);
  return response;
}
async function record(task,startedAt,status,report) {
  try {
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url||!key)return;
    const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
    const processed=Number(report.deleted??report.removed??report.scanned??0);
    const failed=Number(report.failed??0);
    const summary={};
    for(const field of ["mode","deleted","removed","failed","skipped","scanned","eligible","recovered","unconfirmed","pending","retry","truncated"]){
      if(typeof report[field]==="string"||typeof report[field]==="number"||typeof report[field]==="boolean")summary[field]=report[field];
    }
    const {error}=await db.from("invitation_retention_run_logs").insert({
      task,started_at:startedAt,http_status:status,result_mode:report.mode||null,
      processed_count:Number.isFinite(processed)?processed:0,
      failed_count:Number.isFinite(failed)?failed:0,result_summary:summary
    });
    if(error)console.warn("Retention run logging unavailable",error.code);
  } catch(error){console.warn("Retention run logging failed",error?.message);}
}
