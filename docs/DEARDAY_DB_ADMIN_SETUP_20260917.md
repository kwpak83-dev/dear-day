# DearDay DB / 관리자 보안 구축 기록 — 2026-09-17

> 목적: 2026-09-17 Supabase 운영 DB에서 수동으로 구축·검증한 템플릿 데이터 구조와 관리자 권한 기반을 기록한다.
>
> 중요: 아래 DB 변경은 Supabase SQL Editor에서 직접 적용된 운영 DB 상태다. 아직 GitHub의 `supabase/migrations`에 동일한 migration으로 완전히 반영되지 않았다. 추후 실제 스키마/정책/트리거를 다시 조회한 뒤 fresh environment용 migration으로 안전하게 기록해야 한다. 운영 DB에 이미 존재하는 객체를 무조건 재생성하는 migration을 실행하지 않는다.

## 1. 기존 구조 확인

기존 `public.templates`에는 다음 기반이 있었다.

- `id uuid`
- `name`
- `event_kinds event_kind[]`
- `thumbnail_url`
- `preview_config jsonb`
- `is_active`
- `sort_order`
- `created_at`

`public.events.template_id`는 `templates`를 참조하고 있었다.

기존 개발용 템플릿 UUID:

- Classic: `10000000-0000-4000-8000-000000000001`
- Romantic: `10000000-0000-4000-8000-000000000002`
- Modern: `10000000-0000-4000-8000-000000000003`

## 2. templates 확장

`public.templates`에 템플릿 플랫폼 운영용 필드를 추가했다.

- `template_key text`
  - 기존 데이터는 `legacy_...` 형식으로 backfill
  - NOT NULL
  - unique index
- `description text`
- `status text not null default 'draft'`
  - 허용값: `draft`, `review`, `sale_ready`, `on_sale`, `stopped`, `archived`
- `current_sale_version_id uuid`
- `is_visible boolean not null default true`
- `updated_at timestamptz not null default now()`
- 기존 `public.set_updated_at()`을 사용하는 `templates_set_updated_at` trigger 적용

기존 개발용 템플릿들은 현재 `draft`, `is_visible=true` 상태를 유지한다.

## 3. template_versions

`public.template_versions`를 구축했다.

주요 구조:

- `id uuid` PK
- `template_id` → templates FK, RESTRICT
- `version int > 0`
- `config jsonb default '{}'`
- `config_schema_version int default 1`
- `status`: `draft`, `review`, `active`, `archived`
- `change_note`
- `created_by` → profiles FK, SET NULL
- timestamps
- unique `(template_id, version)`
- 필요한 indexes 및 updated_at trigger

기존 템플릿 각각에 version 1을 생성했다.

- `config = coalesce(preview_config, '{}')`
- status = `active`
- legacy 초기 버전임을 change note에 기록

`templates.current_sale_version_id`가 해당 템플릿의 v1을 가리키도록 연결했다.

공개 SELECT RLS:

- 정책명: `current sale template versions are public`
- active + visible 템플릿의 current sale version을 공개 조회 가능하게 구성

## 4. events 템플릿 버전 고정

`public.events`에 다음 필드를 추가했다.

- `template_version_id uuid`
- `template_versions` FK, RESTRICT
- index

기존 event는 가능한 경우 해당 템플릿 v1으로 backfill했다.

앱 코드도 이후 수정되어 다음 규칙을 사용한다.

- 새 event 또는 실제 템플릿 변경 시 `templates.current_sale_version_id`를 resolve
- `template_id`와 `template_version_id`를 함께 저장
- 템플릿 선택 해제 시 둘 다 NULL
- 기존 event가 같은 템플릿을 다시 저장하는 것만으로 pinned version이 자동 업그레이드되지 않음

실제 draft 저장 TC에서 `template_version_id`가 정상 저장되는 것을 확인했다.

## 5. template_assets

`public.template_assets`를 구축했다.

주요 구조:

- `id`
- `template_id` FK, RESTRICT
- `asset_type`
  - `thumbnail`
  - `long_preview`
  - `background`
  - `hero_frame`
  - `decoration`
  - `screen_effect`
  - `texture`
  - `other`
- `name`
- `storage_bucket` default `template-assets`
- `storage_path`
- bucket + path unique
- `mime`
- `width`, `height`
- `file_size`
- `has_alpha`
- `sort_order`
- `is_active`
- `created_by`
- timestamps
- validation checks, indexes, updated_at trigger

설계 원칙:

- Asset은 version이 아니라 template에 귀속한다.
- 여러 version에서 동일 Asset을 재사용한다.
- 각 version의 config가 필요한 Asset ID와 배치 설정을 참조한다.

공개 SELECT 정책은 판매 가능한 active asset만 읽도록 구성했다.

## 6. 템플릿 태그

### template_tags

- `id`
- `name`
- `tag_type` default `general`
- `display_order`
- `is_active`
- timestamps
- unique `(name, tag_type)`
- updated_at trigger
- active tag public SELECT

### template_tag_links

- `template_id`
- `tag_id`
- composite PK
- FK cascade
- `created_at`
- index

템플릿과 태그는 many-to-many 구조다.
태그 개수는 코드에 하드코딩하지 않는다.
태그는 추천/검색/필터용이며 event kind 사용 제한 용도가 아니다.

## 7. Storage `template-assets`

Supabase Storage bucket:

- bucket: `template-assets`
- public: true
- file size limit: 15 MB (`15728640`)
- MIME: JPEG / PNG / WebP

경로 규칙:

```text
template-assets/{template_id}/sales/
template-assets/{template_id}/backgrounds/
template-assets/{template_id}/hero/
template-assets/{template_id}/decorations/
template-assets/{template_id}/effects/
template-assets/{template_id}/textures/
```

version별 `v1/v2` 폴더를 만들지 않고 Asset 재사용을 기본으로 한다.

## 8. admin_users

관리자 권한 기반으로 `public.admin_users`를 구축했다.

초기 super admin:

- `user_id`: `80dee347-43ab-417a-8b99-5f3634f4eebf`
- `role`: `super_admin`
- `is_active`: `true`

현재 이 계정은 DearDay Naver 로그인 계정으로 실제 관리자 TC를 완료했다.
카카오 로그인 계정은 현재 일반회원/비관리자 TC 계정으로 유지한다.

`admin_users`:

- RLS ON
- updated_at trigger 적용
- 클라이언트 INSERT/UPDATE/DELETE 정책은 만들지 않음
- 관리자 지정/역할 변경은 향후 server-only + audit log 방식으로 처리

현재 SELECT 정책:

- 정책명: `admins can read own admin record`
- role: authenticated
- 조건: `user_id = auth.uid() AND is_active = true`

## 9. public.is_admin()

실제 운영 DB에서 확인한 함수 정의:

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
      and a.is_active = true
      and a.role in ('admin', 'super_admin')
  );
$function$
```

권한:

- PUBLIC execute revoke
- authenticated execute grant
- anon execute 불가

검증 결과:

- SECURITY DEFINER = true
- STABLE
- `auth.uid()` 사용 확인
- `admin_users` 확인 로직 확인
- `is_active` 확인 로직 확인

## 10. 템플릿 테이블 관리자 write RLS

다음 테이블에 authenticated + `public.is_admin()` 기반 관리자 write 정책을 추가했다.

- `public.templates`
- `public.template_versions`
- `public.template_assets`
- `public.template_tags`
- `public.template_tag_links`

공통 패턴:

```sql
-- INSERT
WITH CHECK (public.is_admin())

-- UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin())

-- DELETE
USING (public.is_admin())
```

기존 공개 SELECT 정책은 유지했다.

## 11. Storage 관리자 write RLS

`storage.objects`의 `template-assets` bucket에 최종 확인된 정책:

- `public reads template assets`
  - public SELECT
  - `bucket_id = 'template-assets'`
- `admins can upload template assets`
  - authenticated INSERT
  - bucket 조건 + `public.is_admin()`
- `admins can update template assets`
  - authenticated UPDATE
  - USING/WITH CHECK 모두 bucket 조건 + `public.is_admin()`
- `admins can delete template assets`
  - authenticated DELETE
  - bucket 조건 + `public.is_admin()`

운영 UI에서는 물리 삭제보다 `template_assets.is_active=false`를 우선한다.
실제 Storage 파일 삭제는 version/config 등에서 참조하지 않는지 확인 후 수행한다.

## 12. 실제 관리자 접근 TC

최소 관리자 템플릿 목록을 구현해 운영 Vercel 환경에서 실제 세션 TC를 완료했다.

경로:

```text
/admin/templates
```

API 흐름:

1. 브라우저 Supabase session access token 전달
2. 서버에서 token으로 실제 사용자 확인
3. 사용자 JWT context로 `public.is_admin()` RPC 실행
4. 관리자일 때만 `templates` 목록 조회
5. 비로그인 401
6. 로그인했지만 비관리자 403

실제 결과:

- Naver super_admin 계정 → `/admin/templates` 접근 및 Classic/Romantic/Modern 목록 조회 성공
- Kakao 일반회원 계정 → `관리자만 접근할 수 있습니다.` 표시, 접근 차단 성공

따라서 DB의 관리자 권한 구조와 실제 로그인 세션/API 연결이 운영환경에서 정상 작동함을 확인했다.

## 13. 다음 작업 시 주의사항

### 반드시 남은 작업

1. 오늘 수동 적용한 T1 + admin/RLS/Storage 구조를 GitHub migration으로 기록한다.
2. migration 작성 전 운영 DB의 실제 column/default/check/FK/index/trigger/policy/function 정의를 다시 조회한다.
3. 추측으로 DDL을 재구성하지 않는다.
4. 운영 DB에 이미 적용된 객체와 충돌하지 않도록 migration 적용 전략을 별도로 검토한다.
5. 관리자 페이지 다음 단계는 기본정보 등록/수정 → Asset 업로드/관리 → Config/Asset Editor → 실제 Renderer preview/version lifecycle 순으로 진행한다.

### 보안 원칙

- 로그인 여부만으로 관리자 권한을 인정하지 않는다.
- 관리자 판정은 서버에서 `public.is_admin()`으로 재검증한다.
- service role key는 절대 브라우저에 노출하지 않는다.
- 관리자 UI의 표시 여부만으로 보안을 구현하지 않는다. API/RLS에서도 차단한다.
- `admin_users` 역할 변경은 일반 클라이언트 write로 열지 않는다.

## 14. GAP 상태 관련

이 문서는 오늘 실제 구축·검증한 DB/보안 상태를 기록하기 위한 문서다.
`docs/DEARDAY_GAP.md`의 공식 GAP 완료/진행 표시는 별도로 검토 후 갱신한다.
