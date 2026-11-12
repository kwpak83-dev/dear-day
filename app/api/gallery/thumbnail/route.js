import { galleryContext, GalleryError, GALLERY_BUCKET } from "../../../../lib/gallery-server";
const fail=(error,status)=>Response.json({error},{status});
export async function PUT(request){
 try{
  const {supabase,event}=await galleryContext(request);
  const id=new URL(request.url).searchParams.get("id");
  if(!/^[0-9a-f-]{36}$/i.test(id||""))return fail("사진 정보가 올바르지 않아요.",400);
  const {data:row,error}=await supabase.from("event_media").select("id,storage_path,gallery_state,gallery_thumbnail_path").eq("id",id).eq("event_id",event.id).maybeSingle();
  if(error||!row||row.gallery_state!=="ready")return fail("저장된 사진을 찾지 못했어요.",404);
  if(row.gallery_thumbnail_path)return Response.json({thumbnailUrl:supabase.storage.from(GALLERY_BUCKET).getPublicUrl(row.gallery_thumbnail_path).data.publicUrl});
  if(request.headers.get("content-type")!=="image/webp")return fail("WebP 썸네일만 업로드할 수 있어요.",415);
  const bytes=new Uint8Array(await request.arrayBuffer());
  if(!bytes.length||bytes.length>150*1024||String.fromCharCode(...bytes.slice(0,4))!=="RIFF"||String.fromCharCode(...bytes.slice(8,12))!=="WEBP")return fail("150KB 이하의 올바른 WebP 파일이 필요해요.",400);
  const path=row.storage_path.replace(/\.[^.]+$/,"")+".thumb.webp";
  const {error:uploadError}=await supabase.storage.from(GALLERY_BUCKET).upload(path,bytes,{contentType:"image/webp",upsert:false,cacheControl:"31536000"});
  if(uploadError&&!(uploadError.statusCode==="409"||String(uploadError.message).toLowerCase().includes("already exists")))return fail("썸네일을 저장하지 못했어요.",500);
  const {error:updateError}=await supabase.from("event_media").update({gallery_thumbnail_path:path}).eq("id",id).eq("event_id",event.id).eq("gallery_state","ready").is("gallery_thumbnail_path",null);
  if(updateError)return fail("썸네일 연결을 저장하지 못했어요.",503);
  return Response.json({thumbnailUrl:supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path).data.publicUrl});
 }catch(error){return fail(error instanceof GalleryError?error.message:"썸네일 처리 중 문제가 발생했어요.",error.status||500);}
}
