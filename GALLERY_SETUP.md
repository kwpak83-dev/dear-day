# 갤러리 배포 및 확인

## 적용 순서

1. 기존 Supabase 프로젝트의 SQL Editor에서 `supabase/migrations/202609110001_invitation_gallery.sql`을 실행합니다. 기존 초기 스키마가 적용된 프로젝트를 대상으로 하며, 이번 SQL은 다시 실행해도 됩니다.
2. Vercel의 Production 환경변수에 `CRON_SECRET`을 추가합니다. 무작위로 만든 긴 문자열(예: 32바이트 이상)을 사용합니다. 파일 정리 API의 인증에 사용하며 브라우저에는 전달하지 않습니다. 기존 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 그대로 사용합니다.
3. GitHub에 변경 파일을 올리고 Vercel에 배포합니다. `vercel.json`의 하루 한 번 정리 작업도 함께 등록됩니다. 서비스 역할 키는 서버 환경변수로만 유지합니다.
4. 로그인 → 초대장을 임시 저장 → 갤러리에 사진 추가 → 새로고침 → 순서 변경·삭제 → 공개 초대장에서 확인합니다.

운영 DB/Storage 접속 설정이 로컬에 없어 운영 프로젝트에 SQL을 직접 실행하지 않았습니다. SQL 미적용 시 편집 화면에 설정 안내가 나오며 기존 공개 청첩장과 대표사진은 계속 표시됩니다.

## 저장 방식

- 대표사진의 `/api/photos`, `coverPhotoUrl`, 기존 파일 경로는 유지합니다.
- 갤러리는 기존 `invitation-photos` 공개 버킷에서 `{사용자 ID}/gallery/{초대장 ID}/{사진 ID}.jpg` 경로를 사용합니다. 기존 대표사진 경로와 겹치지 않습니다. 갤러리를 처음 사용하는 프로젝트에서도 서버가 동일한 버킷을 준비합니다.
- 기존 `event_media`의 `event_id`, `storage_path`, `sort_order`를 재사용합니다. `gallery_state`, `content_hash`, `gallery_updated_at`을 추가합니다.
- 업로드·삭제·순서 변경은 즉시 DB에 저장합니다. `events.settings`를 갤러리 데이터로 덮어쓰지 않으며, 발행된 초대장에도 갤러리 변경이 즉시 반영됩니다.
- 최초 초대장은 임시 저장 후 갤러리 사용이 가능합니다. 편집 화면의 “초대장 저장하고 시작” 버튼을 사용할 수 있습니다.
- 최대 20장을 브라우저와 DB 양쪽에서 검사합니다. 파일 전체 선택을 예약한 뒤 업로드하며, DB에서 초대장 행을 잠가 동시 요청의 정원 초과를 방지합니다.
- 웹용 JPEG의 SHA-256과 초대장 ID에 유일성 제약을 두어 동일한 변환 파일의 중복 등록을 막습니다. 이름만 바꾼 동일 파일도 제외됩니다. 서로 다른 브라우저의 JPEG 인코더 출력이나 편집본까지 시각적으로 비교하는 중복 판별은 하지 않습니다.
- 기존 `preparePhoto`를 그대로 사용해 JPG/PNG/WEBP를 긴 변 1600px 이하, JPEG 품질 0.85, 최대 3MB로 변환합니다. 입력 한도는 사진당 15MB입니다.

## 삭제·중단 복구

- 삭제 요청은 먼저 `deleting`으로 표시해 공개 목록에서 제외합니다. 해당 초대장 소유권과 서버가 만든 갤러리 경로를 확인합니다.
- 다른 `event_media` 또는 대표사진(`cover_image_url`, `settings.coverPhotoUrl`) 참조가 있으면 실제 파일을 지우지 않습니다.
- Storage 삭제 성공 후 DB 행을 제거합니다. Storage나 DB 오류가 발생하면 경로를 남겨 다음 갤러리 조회/업로드/삭제 때 재시도합니다. 이미 지운 파일에 대한 재시도도 가능합니다.
- 업로드 중단·응답 유실 시 예약 행을 유지합니다. 60초 제한의 업로드 요청이 끝날 수 있도록 15분 유예 후 정리합니다. 그 전에 처리 중인 같은 사진의 중복 업로드를 차단합니다.
- 초대장 자체가 삭제되어 `event_media`가 연쇄 삭제되더라도 파일 경로는 `gallery_storage_cleanup`에 남습니다. 같은 사용자가 다른 갤러리에 접속하면 15분이 지난 정리 항목을 재시도합니다.
- 갤러리 API 접근 시 즉시 정리를 재시도하며, 접속하지 않아도 `/api/gallery/cleanup`이 하루 한 번 미완료 파일을 정리하도록 설정했습니다(UTC 19시 기준). `CRON_SECRET`을 설정하고 Production 배포해야 예약 실행됩니다. 키가 없으면 정리 API는 401로 거절합니다. 설정 방식은 [Vercel Cron 안내](https://vercel.com/docs/cron-jobs/quickstart)와 [인증 안내](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)를 따릅니다.
- 정리 도중 오류·시간 제한이 발생하면 DB 기록을 남겨 다음 실행에서 재시도합니다. 다른 곳에서 참조 중인 사진은 정리 대상에서 제외됩니다. Vercel의 Cron 실행 로그에서 실패 여부를 확인할 수 있습니다.
- 공개 버킷을 재사용하므로 파일 URL을 아는 사람은 해당 이미지를 볼 수 있습니다. DB의 공개 갤러리 조회는 발행된 초대장의 `ready` 사진만 허용합니다.

## 검증

- PostgreSQL(PGlite): 마이그레이션 재실행, 소유권, 중복, 업로드 잠금, 동시 20장 제한, 정렬·충돌, 삭제·만료, RLS, 연쇄 삭제 정리 큐.
- 서버 모의 Storage: 인증, 크기/형식 제한, Storage/DB 실패 후 삭제 재시도, 공유 참조 및 대표사진 경로 보호.
- 모바일 Edge/Playwright: 21장 일괄 거절, 다중 업로드/1600px 변환, 중복 제외, 새로고침 복원, 터치 드래그, 순서 충돌 복구, 사진 삭제, 일부 업로드 실패, 2열/lazy loading, 라이트박스 전환/Escape/포커스 복귀, 가로 넘침·브라우저 오류 없음.
- 운영 계정의 실제 Storage 업로드는 배포 후 확인이 필요합니다.

재실행용 테스트는 `tests/gallery/README.md`를 참고하세요. 앱 런타임 의존성은 추가하지 않았습니다.
