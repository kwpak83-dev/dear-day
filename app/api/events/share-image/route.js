// Retired endpoint: never authenticate, capture, upload, or modify an Event.
export const dynamic = "force-dynamic";
const retired = () => Response.json({ error: "자동 공유 이미지 생성 기능이 종료되었습니다.", code: "SHARE_IMAGE_RETIRED" }, { status: 410, headers: { "Cache-Control": "no-store" } });
export const GET = retired;
export const POST = retired;
