import { createClient } from "@supabase/supabase-js";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !serviceKey || !publicKey) return Response.json({error:"관리자 서비스를 준비하지 못했어요."},{status:503});
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if (!token) return Response.json({error:"로그인이 필요합니다."},{status:401});
  const db = createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:authError}=await db.auth.getUser(token);
  if (authError || !user) return Response.json({error:"로그인이 만료되었습니다."},{status:401});
  const scoped=createClient(url,publicKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{autoRefreshToken:false,persistSession:false}});
  const {data:isAdmin,error:adminError}=await scoped.rpc("is_admin");
  if(adminError || isAdmin!==true) return Response.json({error:"관리자 권한이 없습니다."},{status:403});
  const params=new URL(request.url).searchParams;
  const days=params.get("days")||"7";
  if(!["7","30","all"].includes(days))return Response.json({error:"잘못된 조회 기간"},{status:400});
  const search=(params.get("event")||"").trim();
  if(search && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(search))return Response.json({error:"초대장 ID는 UUID 형식이어야 합니다."},{status:400});
  const page=Number(params.get("page")||"1");
  if(!Number.isSafeInteger(page)||page<1||page>1000)return Response.json({error:"잘못된 페이지"},{status:400});
  const since=days==="all"?null:new Date(Date.now()-Number(days)*86400000).toISOString();
  try{
    let audits=db.from("invitation_deletion_audit").select("event_id,outcome,details,event_kind,source_status,storage_cleanup_eligible,created_at",{count:"exact"}).order("created_at",{ascending:false}).range((page-1)*20,page*20-1);
    let jobs=db.from("invitation_storage_cleanup_jobs").select("id,event_id,bucket,status,attempts,last_error,created_at,updated_at,next_attempt_at",{count:"exact"}).order("updated_at",{ascending:false}).range((page-1)*20,page*20-1);
    if(since){audits=audits.gte("created_at",since);jobs=jobs.gte("created_at",since);}
    if(search){audits=audits.eq("event_id",search);jobs=jobs.eq("event_id",search);}
    const [a,j]=await Promise.all([audits,jobs]);
    if(a.error)throw Object.assign(new Error("audit query failed"),{queryStage:"audit",dbCode:a.error.code,dbMessage:a.error.message});
    if(j.error)throw Object.assign(new Error("storage jobs query failed"),{queryStage:"storage-jobs",dbCode:j.error.code,dbMessage:j.error.message});
    const counts={};
    for(const status of ["pending","retry","done","failed"]){
      let q=db.from("invitation_storage_cleanup_jobs").select("id",{count:"exact",head:true}).eq("status",status);
      if(since)q=q.gte("created_at",since);
      if(search)q=q.eq("event_id",search);
      const result=await q;
      if(result.error)throw Object.assign(new Error("storage count query failed"),{queryStage:"storage-count",dbCode:result.error.code,dbMessage:result.error.message});
      counts[status]=result.count||0;
    }
    let completed=db.from("invitation_deletion_audit").select("event_id",{count:"exact",head:true}).eq("outcome","completed");
    if(since)completed=completed.gte("created_at",since);
    if(search)completed=completed.eq("event_id",search);
    const completedResult=await completed;
    if(completedResult.error)throw Object.assign(new Error("audit count query failed"),{queryStage:"audit-count",dbCode:completedResult.error.code,dbMessage:completedResult.error.message});
    return Response.json({
      audits:a.data||[],auditTotal:a.count||0,
      jobs:(j.data||[]).map(({last_error,...job})=>({...job,errorFlag:Boolean(last_error)})),
      jobTotal:j.count||0,counts,completed:completedResult.count||0,page
    },{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("Deletion logs query failed",{stage:error.queryStage,code:error.dbCode,message:error.dbMessage||error.message});
    return Response.json({error:"삭제 기록을 조회하지 못했습니다.",stage:error.queryStage||"unknown",code:error.dbCode||"unknown"},{status:500});
  }
}
