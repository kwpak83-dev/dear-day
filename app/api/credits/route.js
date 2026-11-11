import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
export async function GET(request) {
 const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!token) return NextResponse.json({error:"로그인이 필요해요."},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) return NextResponse.json({error:"이용권 서비스를 준비하지 못했어요."},{status:503});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user) return NextResponse.json({error:"로그인이 만료되었어요."},{status:401});
 const [grants,ledger]=await Promise.all([
 db.from("credit_grants").select("id,source,quantity,remaining,expires_at,reason,created_at").eq("user_id",user.id).order("expires_at",{ascending:true}),
 db.from("credit_ledger").select("id,grant_id,event_id,action,amount,reason,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100)
 ]);
 if(grants.error||ledger.error) return NextResponse.json({error:"이용권 내역을 불러오지 못했어요."},{status:503});
 const now=Date.now(),balance=(grants.data||[]).reduce((sum,g)=>sum+(new Date(g.expires_at).getTime()>now?g.remaining:0),0);
 return NextResponse.json({balance,grants:grants.data,ledger:ledger.data});
}
