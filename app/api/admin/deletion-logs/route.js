import { createClient } from "@supabase/supabase-js";
export const dynamic = "force-dynamic";
const auditTime = (row) => row.created_at || null;

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
    let audits=db.from("invitation_deletion_audit").select("*",{count:"exact"}).order("created_at",{ascending:false}).range((page-1)*20,page*20-1);
    let jobs=db.from("invitation_storage_cleanup_jobs").select("id,event_id,owner_id,bucket,status,attempts,last_error,created_at,updated_at,next_attempt_at",{count:"exact"}).order("updated_at",{ascending:false}).range((page-1)*20,page*20-1);
    if(since){audits=audits.gte("created_at",since);jobs=jobs.gte("updated_at",since);}
    if(search){audits=audits.eq("event_id",search);jobs=jobs.eq("event_id",search);}
    const [a,j]=await Promise.all([audits,jobs]);
    if(a.error)throw Object.assign(new Error("audit query failed"),{queryStage:"audit",dbCode:a.error.code,dbMessage:a.error.message});
    if(j.error)throw Object.assign(new Error("storage jobs query failed"),{queryStage:"storage-jobs",dbCode:j.error.code,dbMessage:j.error.message});
    const counts={};
    for(const status of ["pending","retry","done","failed"]){
      let q=db.from("invitation_storage_cleanup_jobs").select("id",{count:"exact",head:true}).eq("status",status);
      if(since)q=q.gte("updated_at",since);
      if(search)q=q.eq("event_id",search);
      const result=await q;
      if(result.error)throw Object.assign(new Error("storage count query failed"),{queryStage:"storage-count",dbCode:result.error.code,dbMessage:result.error.message});
      counts[status]=result.count||0;
    }
    const auditPage=a.data||[];
    const auditByEvent=new Map(auditPage.filter(x=>x.event_id).map(x=>[x.event_id,x]));
    const auditTotal=a.count||0;
    let completedQuery=db.from("invitation_deletion_audit").select("event_id",{count:"exact",head:true}).eq("outcome","completed");
    if(since)completedQuery=completedQuery.gte("created_at",since);
    if(search)completedQuery=completedQuery.eq("event_id",search);
    const completedResult=await completedQuery;
    if(completedResult.error)throw Object.assign(new Error("completed audit count query failed"),{queryStage:"audit-count",dbCode:completedResult.error.code,dbMessage:completedResult.error.message});
    const completedCount=completedResult.count||0;
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
      runs,runLogsAvailable,uploadReservationsEnabled:process.env.INVITATION_UPLOAD_RESERVATIONS_READY==="true",
      audits:auditPage.map(x=>({...x,created_at:auditTime(x),loginEmail:emailByOwner.get(x.owner_id)||null,userName:nameByOwner.get(x.owner_id)||null})),auditTotal,
      jobs:(j.data||[]).map(({last_error,...job})=>({...job,loginEmail:emailByOwner.get(job.owner_id)||null,userName:nameByOwner.get(job.owner_id)||null,event_title:auditByEvent.get(job.event_id)?.event_title||null,event_starts_at:auditByEvent.get(job.event_id)?.event_starts_at||null,errorFlag:Boolean(last_error)})),
      jobTotal:j.count||0,counts,completed:completedCount,page,auditTruncated:false,auditUndated:0
    },{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("Deletion logs query failed",{stage:error.queryStage,code:error.dbCode,message:error.dbMessage||error.message});
    return Response.json({error:"삭제 기록을 조회하지 못했습니다.",stage:error.queryStage||"unknown",code:error.dbCode||"unknown",detail:error.dbCode==="42703"?error.dbMessage:undefined},{status:500});
  }
}
