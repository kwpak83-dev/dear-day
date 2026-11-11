import { createClient } from "@supabase/supabase-js";
export const dynamic = "force-dynamic";
const auditTime = (row) => row.deleted_at || row.recorded_at || row.executed_at || row.finished_at || row.completed_at || row.created_at || row.updated_at || row.attempted_at || null;
const withinPeriod = (row, since) => !since || !auditTime(row) || Date.parse(auditTime(row)) >= Date.parse(since);

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
    let audits=db.from("invitation_deletion_audit").select("*").limit(1000);
    let jobs=db.from("invitation_storage_cleanup_jobs").select("id,event_id,owner_id,bucket,status,attempts,last_error,created_at,updated_at,next_attempt_at",{count:"exact"}).order("updated_at",{ascending:false}).range((page-1)*20,page*20-1);
    if(since){jobs=jobs.gte("created_at",since);}
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
    const auditRows=(a.data||[]).filter(row=>withinPeriod(row,since)).sort((left,right)=>Date.parse(auditTime(right)||0)-Date.parse(auditTime(left)||0));
    const auditTotal=auditRows.length;
    const auditPage=auditRows.slice((page-1)*20,page*20);
    const completedCount=auditRows.filter(row=>row.outcome==="completed").length;
    const runQuery=db.from("invitation_retention_run_logs").select("id,task,started_at,finished_at,http_status,result_mode,processed_count,failed_count,result_summary").order("finished_at",{ascending:false}).limit(30);
    const runResult=await runQuery;
    const runLogsAvailable=!runResult.error;
    if(runResult.error && runResult.error.code!=="42P01" && runResult.error.code!=="PGRST205")console.warn("Retention run history unavailable",runResult.error.code);
    const runs=(runResult.data||[]).filter(row=>!since||Date.parse(row.started_at)>=Date.parse(since));
    // Resolve account emails only after the server-side administrator check.
    // Deleted invitations cannot be joined to events; use retained owner_id.
    const ownerIds=[...new Set([...auditPage,...(j.data||[])].map(row=>row.owner_id).filter(id=>typeof id==="string" && /^[0-9a-f-]{36}$/i.test(id)))];
    const emailByOwner=new Map();
    const nameByOwner=new Map();
    await Promise.all(ownerIds.map(async id=>{
      try {
        const {data,error}=await db.auth.admin.getUserById(id);
        if(!error && data?.user){
          const account=data.user;
          const profileEmail=account.user_metadata?.email;
          const loginEmail=account.email;
          const isRealEmail=(value)=>typeof value==="string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !value.toLowerCase().endsWith("@accounts.dear-day.com");
          const realEmail=isRealEmail(profileEmail)?profileEmail:isRealEmail(loginEmail)?loginEmail:null;
          if(realEmail)emailByOwner.set(id,realEmail);
          const realName=account.user_metadata?.name;
          if(typeof realName==="string" && realName.trim())nameByOwner.set(id,realName.trim());
        }
      } catch {}
    }));
    return Response.json({
      runs,runLogsAvailable,
      audits:auditPage.map(x=>({...x,created_at:auditTime(x),loginEmail:emailByOwner.get(x.owner_id)||null,userName:nameByOwner.get(x.owner_id)||null})),auditTotal,
      jobs:(j.data||[]).map(({last_error,...job})=>({...job,loginEmail:emailByOwner.get(job.owner_id)||null,userName:nameByOwner.get(job.owner_id)||null,errorFlag:Boolean(last_error)})),
      jobTotal:j.count||0,counts,completed:completedCount,page,auditTruncated:(a.data||[]).length===1000,auditUndated:auditRows.filter(row=>!auditTime(row)).length
    },{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("Deletion logs query failed",{stage:error.queryStage,code:error.dbCode,message:error.dbMessage||error.message});
    return Response.json({error:"삭제 기록을 조회하지 못했습니다.",stage:error.queryStage||"unknown",code:error.dbCode||"unknown",detail:error.dbCode==="42703"?error.dbMessage:undefined},{status:500});
  }
}
