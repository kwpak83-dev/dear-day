# DearDay GAP 개발 현황

> 목적: `docs/DEARDAY_REQUIREMENTS.md`를 기준으로 현재 구현 상태와 다음 개발 순서를 추적한다.
> 상태 표기: 🟢 완료 / 🟡 진행·일부 구현 / 🔴 미구현

| GAP | 개발 항목 | 상태 |
|---|---|---|
| ① | eventKind 저장/불러오기 | 🟢 완료 |
| ①-A | 신규 초대장 slug 재사용 버그 | 🟢 완료 |
| ② | 행사 종류 선택 UI | 🟢 완료 |
| ③-A | 템플릿 저장/복원 기반 | 🟢 완료 |
| ③-B | 카드형 템플릿 선택 UI | 🟢 완료 |
| ④-A | 행사별 Config + 기본 편집필드 | 🟢 완료 |
| ④-B | 행사별 섹션 + 장소 입력 개선 | 🟢 완료 |
| ⑤-A | 공통 InvitationRenderer / presentation / 템플릿 구조 | 🟢 완료 |
| ⑤-B | 전체 미리보기 + 공개 초대장 공통 Renderer | 🟢 완료 |
| ⑥-A | 판매용 Romantic 001 | 🟢 완료 |
| ⑥-B | 판매용 Modern 001 | 🟢 완료 |
| ⑥-C | 판매용 Classic 001 | 🟢 완료 |
| ⑥-D | Gallery / Lightbox / 모바일 Swipe | 🟢 완료 |
| ⑥-E | 주소 복사 + Naver 지도 | 🟢 완료 |
| ⑥-F | 계좌 복사 | 🟢 완료 |
| ⑥-G | 세션 만료 → 재로그인 | 🟢 완료 |
| ⑥-H | 제작중 초대장 삭제 | 🟢 완료 |
| ⑥-I | `청첩장 보기` → `초대장 보기` 공통화 | 🟢 완료 |
| ⑥-J | 템플릿 행사종류 독립화 | 🟢 완료 |
| ⑦-A | 결제/발행 상태 구조 `draft → paid → published` | 🟢 완료 |
| ⑦-B | Mock 결제 → 결제완료/미발행 → 최종발행 | 🟢 완료 |
| ⑦-C | 결제/발행 모달·지도 stacking 문제 | 🟢 완료 |
| ⑧-A | 링크 복사 + 네이티브 공유 | 🟢 완료 |
| ⑧-B | QR 생성 + 스캔 + PNG 저장 | 🟢 완료 |
| ⑧-C | 공유 기능 최종 통합 TC | 🟢 완료 |
| ⑨-A | RSVP 공개 제출 / ON·OFF / 행사 시작 후 마감 / 서버 검증 | 🟢 완료 |
| ⑨-B | RSVP 개인 수정 링크 | 🟢 완료 |
| ⑨-C | 하객 관리 / 요약 / 필터 / 초대장별 데이터 분리 | 🟢 완료 |
| ⑨-D | RSVP Excel 다운로드 | 🟢 완료 |
| ⑨-E | 동일 브라우저·동일 초대장 RSVP 중복 제출 UX 방지 | 🟢 완료 |
| ⑨ | RSVP / 하객 관리 / Excel | 🟢 완료 |
| ⑩ | 방명록 | 🟢 완료 |
| ⑩-A | 소유자 `초대장 보기` 진입 시 내 초대장/홈 복귀 UX | 🟢 완료 |
| ⑩-B | 공개 초대장 Quick Menu + RSVP/방명록 Bottom Sheet 기본 기능/UX | 🟢 완료 — 공개 화면 운영 TC 및 UX 보완 완료 |
| **⑩-C** | **Quick Menu 2차 기능 확장** | **🔴 미구현 — 설정/버튼별 노출/행사별 문구/최종 회귀 TC** |
| ⑪ | 마이페이지 완성 | 🟢 완료 |
| ⑪-D | 문의내역 / 문의하기 | 🟢 완료 |
| ⑪-E | Naver 내 정보 프로필 보완 | 🟢 완료 |
| ⑫ | 보관기간 / 만료 / 유료연장 / 알림 | 🟢 완료 |
| **⑬-T1** | **템플릿 DB + Storage + Asset/Config 구조** | **🟢 기반 완료** |
| **⑬-T2** | **관리자 템플릿 등록/수정 UI** | **🟢 C1~C5 완료 / 운영 TC 완료** |
| ⑬-T3 | Asset/Config ↔ InvitationRenderer 연결 | 🟢 완료 — C6-1~C6-4, Hero mode/zoom/background/frame 후속 개선, 관리자 Draft Live Preview, C6 통합 회귀 완료 |
| ⑬-T4 | 실제 Renderer 미리보기 + 버전/판매상태 관리 | 🟢 완료 — Draft→판매 Version 확정, 판매중지/재개, Event pinning, 사용자/Public Renderer 운영 TC 완료 |
| ⑬-A | 판매용 템플릿 20~30개 확대 | 🟡 진행 중 — Warm Ivory 첫 실전 마스터 E2E 검증 완료, Spring Blossom Hero 표현 확장 검증 진행 |
| ⑫-A | 상품/요금제 구조 + 단건·다회 이용권 상품 기반 | 🔴 |
| ⑫-B | 이용권 구매분·사용량·잔여수량·유효기간 관리 | 🔴 |
| ⑬ | 관리자 페이지 나머지 운영 기능 | 🔴 |
| ⑬-B | 전체 UI 디테일 디자인 / 레이아웃 최종 폴리싱 | 🔴 |
| ⑭ | 실제 PG 결제 + 자동환불 | 🔴 |
| ⑮ | 전체 통합 TC / 보안·안정화 / 오픈 준비 | 🔴 |
| ⑯ | DearDay 정식 오픈 | 🔴 |

> **현재 개발 우선순위 (2026-09-22):** `⑩-C Quick Menu 2차 기능 확장 → ⑬-A 판매용 템플릿 확대/실전 템플릿 검증 계속 → ⑫-A → ⑫-B → ⑬ → ⑬-B → ⑭ → ⑮ → ⑯`
>
> 템플릿 시스템을 데이터 기반으로 유지하며, 일반적인 신규 디자인은 관리자에서 처리하고 새로운 기능/Renderer 능력만 개발 작업으로 분리한다.

## ⑨ RSVP 완료 범위

- 공개 초대장에서 비회원 RSVP 제출이 가능하다.
- RSVP ON/OFF 및 행사 시작 시 자동 마감 정책을 적용한다.
- 제출 후 개인 수정 링크를 발급하고 기존 응답을 수정할 수 있다.
- 동일 브라우저에서 동일 초대장에 다시 방문하면 빈 신규 폼 대신 `이미 참석 여부를 전달하셨어요.` 상태와 수정 동선을 표시해 실수로 인한 중복 제출을 줄인다.
- 브라우저 저장 정보는 초대장별로 분리하며, 다른 브라우저·기기 또는 저장정보 삭제 시 신규 폼이 다시 보일 수 있는 익명 RSVP 구조를 유지한다.
- 소유자 하객 관리 화면에서 초대장별 응답 요약·필터·목록을 확인할 수 있다.
- 전체 RSVP 데이터를 실제 `.xlsx` 파일로 다운로드할 수 있다.

## ⑩ 방명록 완료 범위

- 방명록은 기본 ON이며 초대장 소유자가 ON/OFF 할 수 있다.
- 비회원 하객이 이름, 메시지, 숫자 4자리 삭제 비밀번호로 작성할 수 있다.
- 삭제 비밀번호는 원문이 아닌 안전한 해시로 저장한다.
- 작성자는 올바른 4자리 비밀번호로 본인 글을 삭제할 수 있고 잘못된 비밀번호는 거부한다.
- 초대장 소유자는 하객 관리에서 비밀번호 없이 자신의 초대장 방명록을 삭제할 수 있다.
- OFF 시 공개 작성폼/목록을 숨기되 기존 데이터는 보존하며 다시 ON 하면 복원한다.
- 공개 작성/삭제에 기본 rate limit을 적용한다.
- 실제 TC에서 작성, 즉시 표시, 비밀번호 삭제 성공/실패, OFF/ON 데이터 복원, 소유자 삭제를 확인했다.

## ⑩-A 소유자 공개 초대장 복귀 UX 완료 범위

- `내 초대장 → 초대장 보기` 등 DearDay 내부 소유자 진입 링크에만 `?from=owner` UI 힌트를 사용한다.
- 소유자 진입 시 공개 초대장 상단에 `내 초대장` 및 `DearDay 홈` 복귀 UI를 표시한다.
- 일반 하객이 공유 링크·QR·공개 URL로 직접 진입한 경우에는 관리용 복귀 UI를 표시하지 않는다.
- query parameter는 UI 표시 용도로만 사용하며 관리 권한 판정에는 사용하지 않는다.
- 공개 초대장 URL/slug 구조와 RSVP, 방명록, 지도, 갤러리, 공유, QR 등 기존 기능은 유지한다.
- 실제 TC에서 PC 소유자 링크 이동, 모바일 소유자 표시/링크 이동, 일반 하객 공개 URL 미노출을 확인했다.

## ⑩-B 공개 초대장 Quick Menu + Bottom Sheet 기본 기능/UX 완료 범위 (2026-09-22)

- 공개 초대장의 긴 RSVP/방명록 인라인 UX를 하단 Quick Menu 기반 접근 방식으로 정리했다.
- Quick Menu는 최초 접속 시 숨겨지고, 실제 초대장 최하단 trigger가 viewport에 진입하면 아래에서 나타난다. 한 번 나타난 뒤에는 위로 다시 스크롤해도 화면 하단 fixed 상태를 유지하며 새로고침 시 다시 숨김 상태로 시작한다.
- 활성 기능에 따라 `참석 여부`, `오시는 길`, `축하 메시지` 버튼만 표시한다. RSVP/방명록/장소 및 Template Sections 비활성화 상태를 기존 조건과 연동한다.
- `참석 여부`와 `축하 메시지`는 기존 RSVP/Guestbook 컴포넌트와 API를 재사용한 Bottom Sheet로 열며, 별도 데이터 구조를 만들지 않는다.
- `오시는 길`은 기존 장소 섹션으로 이동하며 reduced-motion 설정을 존중한다.
- Bottom Sheet는 dim backdrop, 닫기 버튼, 바깥 영역 클릭, Esc 닫기, body scroll lock, 내부 스크롤, safe-area를 지원한다.
- Sheet 최대 높이는 `90dvh` 이내이며 화면 상단에 최소 56px이 남도록 제한해 원래 초대장이 일부 보이는 Bottom Sheet UX를 유지한다.
- Quick Menu가 마지막 `Thank you` 콘텐츠를 가리지 않도록 공개 초대장 하단에 Quick Menu 높이와 safe area를 고려한 76px 보호 여백을 둔다.
- Quick Menu와 Bottom Sheet의 버튼/포인트 색상은 기존 `colors.buttonBackground`, `colors.buttonText`, `colors.accent`, `colors.divider` CSS 변수를 우선 재사용한다. Config가 없으면 Classic gold, Modern ink, Romantic rose/gold fallback을 유지한다.
- RSVP 완료 화면은 `참석 여부 수정하기`를 Secondary action(투명 배경 + 템플릿 accent 테두리/글자), `수정 링크 복사`를 Primary action(템플릿 button 배경/글자)으로 구분했다.
- 구형 내부 trigger와 `triggerRef/useRef` 잔여 코드로 발생한 Public Invitation 런타임 오류를 제거하고, `page.js`의 실제 최하단 `#invitation-quick-menu-trigger`만 사용하도록 정리했다.
- Preview 경로는 기존 인라인 RSVP/방명록을 유지해 관리자 Draft Preview와 사용자 LIVE Preview를 보호한다.
- 배포 후 운영 화면에서 최하단 등장, 등장 후 fixed 유지, 템플릿 색상 연동, RSVP Bottom Sheet, RSVP 완료 화면, Guestbook Bottom Sheet, 최하단 콘텐츠 비가림을 확인했다.
- 상세 구현/회귀 항목은 `docs/DEARDAY_QUICK_MENU_UPDATE_20260922.md`, `docs/DEARDAY_QUICK_MENU_TC_20260922.md`를 기준으로 한다.

## ⑩-C Quick Menu 2차 기능 확장 — 미구현

⑩-B에서 Quick Menu와 Bottom Sheet의 기본 기능 및 UX는 완료했지만, 아래 운영/설정 기능은 별도 2차 작업으로 남긴다.

- Quick Menu 전체 사용 ON/OFF 설정.
- `참석 여부`, `오시는 길`, `축하 메시지` 버튼별 개별 표시 설정.
- RSVP/방명록/장소 또는 Template Sections가 OFF인 경우 기존 자동 숨김 정책과 관리자 설정의 우선순위 정의.
- 결혼식/돌잔치/생일/모임·동창회/파티/직접 만들기 등 행사 종류에 맞춘 버튼 명칭·문구 정책 검토 및 적용.
- 필요한 경우 관리자 또는 사용자 Config에서 설정 가능하도록 연결하되, 기존 RSVP/Guestbook/Location 기능과 API는 재사용한다.
- 기존 템플릿 Colors Config 상속과 Classic/Modern/Romantic fallback 정책을 유지한다.
- 390px/540px 및 실제 모바일 환경에서 버튼 조합별 레이아웃, Bottom Sheet, 오시는 길 이동, 기능 ON/OFF 조합을 최종 회귀 TC한다.
- ⑩-C 완료 전까지 ⑩-B의 기본 Quick Menu 기능은 운영 가능한 완료 상태로 유지한다.

## ⑪ 마이페이지 완료 범위

- 공통 `MyPageLayout`을 기반으로 PC 왼쪽 사이드바와 모바일 상단 가로 메뉴를 제공한다.
- `내 초대장`, `하객 관리`, `내 정보`, `문의내역`을 실제 기능 화면으로 연결한다.
- 모바일 마이페이지 본문은 공통 16px 좌우 여백을 적용해 메뉴별 정렬과 가로 overflow를 통일한다.
- 메인 PC 헤더와 모바일 햄버거 메뉴에서 `마이페이지` 진입 동선을 제공한다.
- 발행된 초대장의 발행 중지/재발행 흐름을 지원하며 동일 slug와 데이터를 유지한다.
- `내 정보`에서 로그인 방식, 이름/닉네임, 이메일, 가입일을 확인할 수 있고 제공받지 못한 정보는 `정보 없음`으로 처리한다.
- `결제 / 보관`은 ⑫에서 구현하므로 현재 준비중 상태를 유지한다.

## ⑪-D 문의내역 / 문의하기 완료 범위

- 로그인 회원은 마이페이지 `문의내역`에서 문의 유형, 제목, 내용을 입력해 문의를 등록할 수 있다.
- 문의 유형은 초대장 이용, 결제/환불, 계정, 오류/불편, 기타를 지원한다.
- 제목과 내용은 클라이언트와 서버에서 검증하며 빈 값 및 허용 길이 초과 등록을 차단한다.
- 문의 목록은 로그인 사용자의 문의만 최신순으로 표시하고 유형, 제목, 상태, 작성일을 확인할 수 있다.
- 문의 상세에서 원문과 처리 상태를 확인하며 답변 전에는 `답변을 준비하고 있습니다.` 안내를 표시한다.
- 서버 API는 인증된 세션의 실제 `user.id`를 사용하며 클라이언트가 전달하는 작성자 ID를 신뢰하지 않는다.
- 다른 계정의 문의는 조회할 수 없도록 사용자 소유권을 서버에서 검증하고, 브라우저의 직접 테이블 접근은 제한한다.
- `inquiry_replies` 구조를 마련해 향후 ⑬ 관리자 페이지에서 관리자 답변 및 답변완료 처리를 확장할 수 있다.
- 실제 운영 TC에서 문의 작성, 목록/상세, 새로고침 유지, 비로그인 접근 차단, 계정별 데이터 분리, PC/모바일 레이아웃까지 확인했다.

## ⑪-E Naver 내 정보 프로필 보완 완료 범위

- Naver OAuth callback에서 Naver가 제공한 `name`, `nickname`, `email` 프로필 값을 Supabase `user_metadata`에 저장한다.
- 기존 Naver 사용자는 재로그인 시 최신 Naver 프로필 metadata가 자연스럽게 갱신된다.
- 내부 인증용 `naver-...@accounts.dear-day.com` 이메일은 로그인 구조에 유지하되 마이페이지에는 노출하지 않는다.
- `내 정보`에서는 Naver 이름을 우선 표시하고 이름이 없으면 닉네임을 사용하며, 실제 Naver 이메일이 제공된 경우 해당 이메일을 표시한다.
- Naver에서 선택 프로필 정보를 제공하지 않은 경우 로그인 자체는 유지하고 해당 항목만 `정보 없음`으로 처리하는 구조를 유지한다.
- Naver Developers 제공정보에 회원이름, 연락처 이메일 주소, 별명을 선택 항목으로 설정했으며 재로그인 동의 후 실제 이름과 이메일 표시를 확인했다.
- Kakao 프로필 표시, OAuth state 검증, 안전한 returnUrl, 기본 로그인 복귀, provider 표시 및 로그아웃 흐름은 유지한다.
- 선택 프로필 정보에 동의하지 않는 사용자 케이스는 ⑮ 전체 통합 TC에서 최종 확인한다.

## ⑫ 보관기간 / 만료 기반 완료 범위

- 발행된 초대장에 `service_expires_at`, `grace_ends_at`을 저장해 서비스 만료일과 유예기간 종료일을 관리한다.
- 현재 요구사항 기준으로 행사일(`starts_at`) +14일을 공개 이용기간으로, 이후 30일을 유예기간으로 적용한다.
- 런타임 보관기간 정책값은 공통 retention 로직에서 관리하며, 가격·플랜 정책과 분리한다.
- 행사일을 앞당겨도 이미 확보한 만료일은 줄이지 않고, 행사일을 뒤로 미루면 새 행사일 기준으로 만료일을 연장한다.
- 기존 `draft / paid / published / suspended` 상태 enum을 유지하고 정상 이용중 / 이용기간 만료 / 유예기간 등의 상태는 날짜 기반으로 계산한다.
- 만료된 공개 초대장은 서버에서 본문·갤러리를 렌더링하지 않고 `이 초대장은 이용기간이 만료되었습니다.` 안내를 표시한다.
- RSVP와 방명록 API에도 서버 측 만료 검증을 적용해 만료된 초대장에 새 공개 데이터가 등록되지 않도록 한다.
- 공개 RLS의 published 이벤트 조회 조건에도 서비스 만료 여부를 반영한다.
- 마이페이지 `내 초대장`에서 정상 이용중, 만료, 유예기간 및 관련 날짜를 확인할 수 있다.
- `event_retention_extensions`를 추가해 향후 유료연장·이용권·관리자 연장의 이전/신규 만료일과 출처를 기록할 기반을 마련한다.
- 기존 운영 데이터 사전점검 결과 published 14건, suspended 1건 모두 `starts_at`이 존재했고, 의미가 확정되지 않은 `ends_at`은 서비스 만료 백필에 사용하지 않았다.
- 실제 운영 TC에서 신규 발행 시 만료일 생성, 정상 이용 상태, 행사일 앞당김 시 기존 만료일 보호, 행사일 연기 시 만료일 연장, 강제 만료 시 유예기간 표시와 공개 URL 차단, 원복 후 정상화, 발행 중지 시 URL 차단 및 재발행 시 복원을 확인했다.
- 실제 자동삭제 스케줄러, 실제 알림 발송, 유료연장 결제/API는 이번 완료 범위에 포함하지 않으며 후속 GAP에서 구현한다.

## ⑬-T1 템플릿 DB + Storage + Asset/Config 구조

- `docs/DEARDAY_TEMPLATE_SPEC.md`를 기준으로 데이터 기반 템플릿 구조를 구현한다.
- 템플릿은 안정적인 `template_id`와 버전을 가지며, 기존 발행본은 사용한 버전에 고정할 수 있어야 한다.
- 판매/마케팅 Asset과 실제 Renderer Asset을 분리한다.
- 기본 Asset 슬롯은 `① 판매 썸네일`, `② 긴 판매 미리보기`, `③ 배경`, `④ Hero 프레임/마스크`, `⑤ 장식`, `⑥ 효과`, `⑦ 텍스처`를 지원한다.
- ①~④를 기본 핵심 슬롯으로 취급하고 ⑤~⑦은 디자인에 따라 선택적으로 사용할 수 있게 한다. 슬롯 수를 영구적으로 7개에 하드코딩하지 않고 향후 추가 Asset을 확장할 수 있는 구조를 고려한다.
- ④~⑥ 등 Overlay Asset은 실제 Alpha 투명 PNG를 지원하고, ⑦ 텍스처는 디자인 성격에 따라 투명 Overlay형 또는 불투명 배경형을 모두 허용한다.
- Asset별 위치, 크기, opacity, rotation, z-order, mask/crop 등 Renderer에 필요한 설정을 DB/config로 저장할 수 있게 한다.
- 고객 사진은 Asset과 분리하며 사용자가 사진 위치 X/Y와 확대/축소를 조정할 수 있는 구조를 유지한다.
- 일반적인 신규 디자인 등록을 위해 코드 수정이나 재배포가 필요하지 않도록 Storage 경로와 config를 데이터 기반으로 관리한다.

## ⑬-T2 관리자 템플릿 등록/수정 UI

### 현재 구현 상태 (2026-09-22)

- 🟢 템플릿 기본정보 등록·수정, 상태·노출·정렬순서 관리
- 🟢 Template key 검증 및 앞뒤 공백 처리
- 🟢 관리자용 템플릿 Asset 영역 및 모바일 대응 UI
- 🟢 판매 썸네일, 긴 판매 미리보기, 배경, Hero 프레임, 장식, 화면효과, Texture 업로드
- 🟢 JPG/PNG/WebP 및 15MB 업로드 제한
- 🟢 운영 DB의 `template_assets.mime_type` 컬럼 기준 metadata 저장
- 🟢 Asset 취소 rollback 동작 및 운영 TC 완료
- 🟢 Background/Decoration은 multi-active, 나머지 단일 슬롯형 Asset은 single-active 교체 정책
- 🟢 기존 Asset 활성화/비활성화 양방향 전환 및 동일 Asset ID 재사용
- 🟢 TemplateVersions/TemplateAssets React key 충돌로 인한 중복 렌더링 HOTFIX 완료
- 🟢 Draft Version 생성/재사용 및 `template_versions.config` 저장 기반
- 🟢 **C1 Decoration Config**: slot, X/Y, size, rotation, opacity, zIndex, visible 저장/복원 및 운영 TC 완료
- 🟢 **C2 Background + Hero Config**: 전체 Background와 Hero의 독립 Asset 선택, overlay, Hero mode/aspectRatio/X/Y/zoom/frame 저장/복원 및 운영 TC 완료
- 🟢 C2 저장 시 C1 Decoration Config 보존 확인
- 🟢 동일 Background Asset을 전체 Background와 Hero에서 함께 재사용 가능하며, 필요 시 서로 다른 Background Asset도 선택 가능
- 🟢 판매용 Asset은 기존 기본 7종 체계를 유지하고, 디자인상 필요한 템플릿만 추가 Background Asset을 선택적으로 등록하는 정책
- 🟢 **C3 Typography + Colors**: 4개 typography role + 7개 color role 저장/복원 및 운영 TC 완료
- 🟢 **C4 Sections Config**: Hero 제외 6개 공통 섹션 순서/기본 ON·OFF 저장/복원 및 운영 TC 완료
- 🟢 **C5 Effects / BGM / Safe Area Config**: scroll reveal enum, BGM 최소 기반(mode=none), Safe Area 저장/복원 및 운영 TC 완료
- 🟢 **C6-1 Renderer Config Normalization Foundation**: C1~C5 Config 공통 정규화 기반 추가, 기존 공개 화면 회귀 TC 완료
- 🟢 **C6-2 Pinned Version Renderer 연결**: 공개 초대장이 event.template_version_id 기준 config를 읽고 Background/Hero/Typography/Colors를 적용하도록 구현 완료. 공개 pinned 경로는 유지하면서 관리자 Draft Live Preview에서 Draft C2/C3의 실제 Renderer 시각 검증 완료
- 🟢 **관리자 Draft Live Preview**: 실제 `InvitationRenderer`와 fixture 데이터를 사용해 판매 버전 없이 Draft Config/Asset을 검증하는 경로 구현 및 운영 TC 완료. 390px/540px 전환, 내부 스크롤, Naver 지도, read-only RSVP/방명록 보호 확인
- 🟢 **C6-3 Decoration + Sections**: Decoration의 slot/X/Y/size/rotation/opacity/zIndex/visible을 실제 Renderer에 적용하고, 6개 공통 Section의 표시/숨김/순서를 실제 DOM에 적용. Admin Draft Preview 운영 TC 완료
- 🟢 **C6-4 Effects + Safe Area**: `none/fade/fade-up` Scroll Reveal과 0~120px Safe Area를 실제 Renderer에 적용. Admin 내부 스크롤 Observer root, reduced-motion/fallback, Background/Hero full-bleed 보호, 390px/540px overflow 운영 TC 완료
- 🟢 **C6 통합 회귀 완료**: Background/Hero/Typography/Colors/Decoration/Sections/Effects/Safe Area 상호작용과 기존 기능 경로를 점검했다. Background/Hero만 설정해도 Typography/Colors override가 활성화될 수 있던 조건을 분리하고, 불완전한 Typography/Colors Config는 기존 템플릿 디자인을 유지하도록 보강했다
- 🟢 **Hero mode Renderer 분기 완료**: Classic/Modern/Romantic 공통으로 `photo`는 대표사진 O/Frame X, `frame`은 대표사진 O/Frame O, `illustration`은 대표사진 X/Hero Background O/Frame 설정 시 O 정책을 사용한다. mode가 없는 기존 Version/Public 초대장은 기존 fallback을 유지한다.
- 🟢 **Hero Zoom 축소/확대 범위 개선**: 관리자/API/Config 정규화 범위를 `0.5~2.0`, step `0.05`로 통일했다. `photo/frame`에서 대표사진 scale에 적용하고 `illustration`에서는 대표사진이 숨겨지므로 시각 영향이 없다.
- 🟢 **Hero Background 레이어 개선**: Hero Background Asset이 있을 때 figure fallback 배경을 투명 처리해 축소된 대표사진 뒤로 Background가 노출되도록 했다. Asset이 없으면 기존 템플릿 fallback 배경을 유지한다.
- 🟢 **Classic 하드코딩 Hero gradient 분리**: Config가 적용된 Classic Hero에서는 기존 `figure::after` gradient를 숨기고 `hero.overlayColor/overlayOpacity` 기반 공통 Overlay만 사용한다. Config 없는 기존 Classic은 기존 gradient를 유지한다.
- 🟢 **BGM 실제 음원 기능 완료**: 관리자 MP3 Asset 업로드, Draft Config 선택/저장, 공통 `InvitationRenderer → TemplateBgm` 재생/정지 연결 및 운영 TC 완료. Vercel 4.5MB Function payload 제한을 피하기 위해 BGM binary는 관리자 브라우저에서 Supabase Storage로 직접 업로드하고 작은 metadata JSON만 API로 전달한다. 최대 15MB, `audio/mpeg`, 관리자 JWT/RLS 및 서버 metadata 재검증/rollback을 유지한다.
- 🟢 **BGM UX 운영 검증 완료**: autoplay 없이 초기 정지, 36px 원형 플로팅 토글(`♪`/`■`), 정지 시 `currentTime=0`, 390/540 Draft Preview, 스크롤 고정, 폭 전환 시 중복 재생 방지까지 확인했다. Admin Draft Preview와 Public Invitation은 동일한 공통 `TemplateBgm` 컴포넌트를 사용한다.

- 관리자에서 `새 템플릿 등록` 화면을 제공하고 템플릿명, 가격/판매 상태, 태그, 표시 순서, 배지 등을 관리한다.
- Asset 슬롯별 업로드, 미리보기, 교체, 삭제를 지원하며 필요한 경우 `+ Asset 추가` 방식으로 확장 가능하게 한다.
- Hero 비율/마스크, 장식 위치, typography, 색상, 섹션 순서/기본 ON·OFF, scroll reveal, 화면효과, BGM, Safe Area 등을 관리자에서 설정할 수 있게 한다.
- 운영 중 변경될 가능성이 있는 템플릿 설정은 가능한 한 코드에 하드코딩하지 않고 DB + 관리자 페이지에서 관리한다.
- 관리자 페이지는 모바일 우선으로 설계해 스마트폰에서도 템플릿 등록·수정·판매상태 변경 등 주요 운영이 가능하도록 한다.

## ⑬-T3 Asset/Config ↔ InvitationRenderer 연결

- 기존 `InvitationRenderer → template → presentation` 구조를 유지하고 새 초대장 기능을 별도로 재구현하지 않는다.
- 기존 이름, 날짜, 장소, 메시지, 갤러리, 계좌, RSVP, 방명록, 지도, 공유 등 공통 기능 위에 템플릿 Asset/config를 디자인 레이어로 적용한다.
- 원칙은 `기능은 공통 / 디자인은 템플릿 설정`으로 한다.
- 고객별 이름·날짜·장소·문구 등 동적 정보는 이미지에 굽지 않고 HTML/presentation 데이터로 렌더링한다.
- 템플릿 추천 행사 태그는 추천/검색/정렬에만 사용하며 행사종류 사용 제한으로 사용하지 않는다.
- 화면효과와 BGM의 사용자 선택값은 템플릿 추천값과 분리해 저장한다.

## ⑬-T3/C6 진행 체크포인트 (2026-09-22)

- C6-1 완료: `normalizeTemplateConfig` 기반을 추가하고 기존 Config 미보유 공개 초대장의 디자인/기능 유지 TC를 통과했다.
- C6-2 구현 완료: 공개 경로는 `current_sale_version_id`가 아니라 이벤트에 pin된 `events.template_version_id`와 동일 `template_id`의 Version Config를 사용한다.
- C6-2에서 Background/Hero/Typography/Colors 적용, 필요한 Asset ID→URL 해석, inactive 과거 Asset 참조 보호를 구현했다.
- 판매 버전을 억지로 만들거나 DB를 직접 조작하지 않고 관리자 Draft Live Preview에서 Draft Config를 실제 `InvitationRenderer`로 검증한다.
- MVP Preview는 시각 확인용이며 Drag/Resize 직접 편집기는 만들지 않는다. 기존 숫자/선택 Config 입력을 유지한다.
- Draft Live Preview, C6-2 실화면 검증, C6-3 Decoration+Sections, C6-4 Effects/Safe Area 및 C6 통합 회귀까지 완료했다.
- 후속 Hero 표현 개선으로 `photo/frame/illustration` 실제 렌더 분기, Zoom `0.5~2.0`, Hero Background→대표사진→Overlay/Frame→Hero Text 레이어 정책을 구현했다. Config가 없는 기존 Version/Public fallback은 유지한다.
- BGM 실제 음원 기능까지 완료했다. MP3 Asset 업로드, Draft Config 연결, 공통 Renderer 재생/정지, 플로팅 토글 UI, 390/540 및 스크롤/중복재생 운영 TC를 통과했다.

## ⑬-T4 실제 Renderer 미리보기 + 버전/판매상태 관리 — 완료 (2026-09-21)

- 관리자 Draft Live Preview, 사용자 우측 LIVE Preview, 사용자 전체 미리보기, 실제 공개 발행본이 공통 `InvitationRenderer`를 사용한다.
- Draft가 있으면 재사용하고, 없으면 현재 판매 Version의 Config/schema version을 복사해 다음 번호 Draft를 생성한다.
- 관리자에서 Draft를 `판매 버전으로 확정`하면 해당 Version을 `active`로 전환하고 `templates.current_sale_version_id`를 갱신한다. 기존 Event의 `events.template_version_id`는 일괄 변경하지 않는다.
- 신규 Event/다른 템플릿 선택/동일 템플릿 명시적 재선택 시에만 현재 판매 Version으로 pin하며, 기존 Event의 단순 내용 수정·저장은 기존 pinned Version을 유지한다.
- 판매 시작은 `status=on_sale, is_visible=true, is_active=true`, 판매 중지는 `status=stopped, is_active=false`를 사용하며 Version/Asset/기존 Event는 보존한다. 판매 재개도 운영 TC를 통과했다.
- 실제 운영 TC에서 v1 기존 초대장이 v2 판매 확정 후에도 v1을 유지하고, 명시적 재선택 시 v2로 전환되는 것을 확인했다.
- 사용자 LIVE Preview의 내부 스크롤 위치 때문에 Hero가 누락돼 보이던 문제를 수정했다. 대표사진/템플릿/pinned Config 변경 시 상단 Hero부터 표시되고 Footer까지 내부 스크롤되는 것을 운영에서 확인했다.
- v2 판매 Version의 Background/Hero Background/Hero Frame/Decoration/BGM/Effects/Safe Area Config와 실제 `template_assets` 참조를 Production DB에서 검증했다.
- Public Invitation에서 Asset 기반 요소만 누락되던 HOTFIX의 root cause는 `template_assets`에 대한 `service_role` SELECT table privilege 부족으로 발생한 PostgreSQL `42501`이었다.
- migration `202609210003_grant_template_assets_select.sql`로 `grant select on table public.template_assets to service_role;`을 추가하고 Production DB에도 동일 권한을 적용했다. anon/authenticated 범위와 RLS policy는 변경하지 않았다.
- HOTFIX 후 실제 공개 v2 초대장에서 Whole Background, Hero Frame, Decoration 등 Asset 기반 디자인이 정상 렌더링되고 Effects도 정상 동작하는 것을 운영 화면에서 확인했다. BGM은 v2 Config/Asset 및 공통 Renderer 연결이 유지된다.
- Public 렌더링은 계속 `events.template_version_id`에 pin된 Version을 사용하며 `current_sale_version_id`를 직접 따라가지 않는다. 과거 pinned Version/Asset 보호 원칙도 유지한다.
- Hero mode/Background/Frame/Zoom의 후속 Renderer 개선은 2026-09-22 완료했으며 기존 pinned Version의 mode 미보유 fallback을 유지한다.
- T4 완료 기준을 충족했으므로 다음 단계는 ⑬-A 판매용 템플릿 확대다.

## ⑬-A 판매용 템플릿 20~30개 확대

### Warm Ivory 첫 실전 마스터 템플릿 E2E 검증 완료 (2026-09-22)

- 관리자 Draft에서 Warm Ivory Asset/Config 및 Whole Background 렌더링을 확인했다. Whole Background는 `background-size: 100% auto`, `background-position: top center`, `background-repeat: repeat-y` 기준으로 긴 초대장 전체에 정상 적용된다.
- 신규 Event에서 DB 판매 템플릿 Warm Ivory를 선택하면 저장 전 LIVE Preview에 정상 반영된다. DB 조회 대기 중 Classic fallback이 잠깐 표시되던 현상을 제거했고, 빠르게 다른 템플릿을 선택해도 이전 비동기 응답이 현재 선택을 덮어쓰지 않는 것을 운영 TC에서 확인했다.
- Warm Ivory 선택 후 저장, 전체 미리보기, Mock 결제, 최종 발행, Public `/invite/[slug]`까지 동일 디자인이 정상 유지되는 것을 확인했다.
- Version Pinning 실전 TC를 완료했다. Warm Ivory 판매 v3로 발행한 기존 Event를 유지한 채 Draft v4의 Background Overlay를 눈에 띄게 변경했고, Draft 수정 상태에서도 기존 Public 초대장은 v3를 유지했다.
- 이후 v4를 새 판매 Version으로 확정해 `current_sale_version_id`가 v4가 된 뒤에도 기존 발행 Event/Public 초대장은 `events.template_version_id`에 pin된 v3 디자인을 그대로 유지했다.
- 따라서 첫 실전 마스터 템플릿의 관리자 등록 → 판매 Version → 사용자 선택/미리보기 → 저장 → 결제/발행 → Public Renderer → 과거 Version pinning까지 End-to-End 운영 검증을 통과했다.
- ⑬-A 전체 목표인 판매용 템플릿 20~30개 확대는 아직 진행 중이며, Warm Ivory 검증 완료를 기준으로 후속 판매 템플릿을 관리자 중심으로 확대한다.

- ⑬-T1~T4에서 완성한 공통 템플릿 규격과 관리자 등록 기능을 사용해 판매용 템플릿을 20~30개 수준으로 확대한다.
- 신규 판매용 디자인은 관리자 페이지에서 직접 등록·수정·비활성화할 수 있는 공통 템플릿 규격을 기준으로 제작한다.
- 템플릿 하나를 추가할 때마다 React 파일 추가, Codex 코드 수정, 재배포가 필요한 구조를 최소화한다.
- 템플릿 자체는 행사종류에 종속시키지 않는다. 행사종류별 차이는 행사 Config와 사용자 입력 데이터가 담당하고 템플릿은 표현 디자인을 담당한다.
- 추천 행사 태그는 선택적으로 사용할 수 있으나 추천/검색/정렬 용도이며 사용 제한 조건으로 사용하지 않는다.
- 공통 템플릿 규격으로 표현하기 어려운 완전히 새로운 레이아웃·인터랙션 또는 새로운 Renderer 능력만 별도 코드 개발 대상으로 분리한다.
- 운영 원칙은 `새로운 디자인은 관리자에서, 새로운 기능/Renderer 능력은 개발에서`로 한다.

## ⑫-A 상품/요금제 구조 + 단건·다회 이용권 상품 기반

- 상품 구조를 B2C/B2B라는 시스템 권한 클래스로 고정하지 않고 일반적인 단건·다회 이용권 상품 구조로 설계한다.
- 일반 고객과 사업자/파트너 모두 필요에 따라 다회 이용권 상품을 구매할 수 있게 확장 가능한 구조를 사용한다.
- 상품별 안정적인 ID, 표시명, 설명, 제공 횟수, 정상가(선택), 판매가, 유효기간/무기한 여부, 판매상태, 노출상태, 표시순서, 배지 등을 DB에서 관리한다.
- 초기 판매 템플릿은 유료를 기본으로 하며 단건 가격은 공통 정책으로 시작할 수 있으나 실제 가격은 관리자에서 변경 가능하게 한다.
- 이미 결제된 주문은 구매 당시 상품명, 가격, 횟수, 유효기간 등 조건 스냅샷을 보존한다.
- 실제 결제 시 클라이언트 가격을 신뢰하지 않고 서버에서 현재 활성 상품과 가격/조건을 다시 조회한다.
- 실제 PG 승인·결제·자동환불은 ⑭에서 구현한다.

## ⑫-B 이용권 구매분·사용량·잔여수량·유효기간 관리

- 이용권은 구매 batch별로 제공 횟수, 사용량, 잔여량, 유효기간을 관리한다.
- 여러 batch가 있을 경우 만료가 빠른 이용권부터 사용하는 FEFO를 기본으로 하고 무기한 이용권은 마지막에 사용한다.
- 이용권 1회는 초대장의 `최종 발행 성공` 시점에만 차감한다. 제작중/미리보기 단계에서는 차감하지 않는다.
- 동일 초대장의 발행중지/재발행 및 발행 후 내용 수정은 추가 차감하지 않으며, 복제한 초대장은 새로운 invitation_id로 첫 발행 시 새로 1회를 차감한다.
- 서버 측에서 차감과 발행을 idempotent/transaction-safe하게 처리해 중복 차감을 방지한다.
- 마이페이지에서 총 잔여량, 가장 가까운 만료일, 구매/사용/만료 이력을 확인할 수 있게 한다.
- 관리자 무료 지급, 조정/회수, 예외적 유효기간 연장은 사유와 감사 로그를 남기는 구조로 확장한다.

## ⑬ 관리자 페이지 나머지 운영 기능

- ⑬-T1~T4의 템플릿 관리자 기능을 기반으로 DearDay의 나머지 일상 운영 콘솔을 완성한다.
- 운영 중 반복적으로 바뀌는 값은 가능한 한 코드 수정·재배포·Supabase SQL 직접 실행 없이 관리자 화면에서 관리한다.
- 상품 추가/수정/판매중지, 정상가/판매가, 제공 횟수, 유효기간, 배지, 표시순서 등을 관리한다.
- 회원 관리에서 회원 검색, 가입일, 로그인 방식, 보유 초대장 및 이용 상태를 확인한다.
- 이용권 관리에서 지급·조정·회수, 구매·사용·잔여 수량, 유효기간 및 사용 내역을 관리한다.
- 초대장 관리에서 전체 초대장을 검색하고 발행 상태, 이용 만료일, 유예기간 등을 확인하며 필요 시 관리자 권한으로 발행 중지/복구 및 보관기간 연장을 한다.
- 문의 관리에서 사용자 문의를 조회하고 관리자 답변 등록 및 답변완료 상태 처리를 한다.
- ⑭ 실제 PG 연동 이후 주문번호, 구매 상품, 구매 당시 가격, 결제 상태 및 환불 상태를 조회·관리할 수 있도록 확장한다.
- Storage 운영 화면에서 회원/초대장별 이미지 사용량, 전체 이미지 사용량 및 만료 데이터 정리 상태를 확인할 수 있는 구조를 고려한다.
- 관리자 대시보드에서 회원 수, 초대장 제작/발행 수, 결제 건수·매출 및 Storage 사용량 등 주요 운영 지표를 확인할 수 있도록 확장한다.
- 행사일 이후 공개 이용기간, 유예기간, draft 최대 개수/자동삭제 기간/알림 시점 등 운영 정책값은 중앙 설정 + 관리자 화면에서 관리할 수 있도록 한다.
- 사이트 공지, 점검 안내, 프로모션/할인 배너 등 운영 메시지를 등록하고 노출 ON/OFF 할 수 있게 한다.
- 주요 관리자 변경은 변경 전/후 값, 변경 시각, 관리자 식별정보를 남기는 감사 로그를 둔다.
- 관리자 권한은 서버 측에서 재검증하며 클라이언트 UI 숨김만으로 보호하지 않는다.
- 모바일 우선 운영을 원칙으로 하여 스마트폰에서 주요 운영 작업을 수행할 수 있도록 한다.

## ⑬-B 전체 UI 디테일 디자인 / 레이아웃 최종 폴리싱

기능 추가보다 고객이 실제로 보는 화면의 시각적 완성도와 사용성을 출시 수준으로 끌어올리는 단계다.

- 버튼의 크기, 색상, 간격, 모서리, 정렬 및 상태 디자인을 통일한다.
- 확인/경고/결제/발행 등 모달·대화상자의 디자인과 레이아웃을 세밀하게 정리한다.
- 입력창, 카드, 토스트, 알림 UI를 일관된 디자인 시스템으로 정리한다.
- 폰트 크기·굵기·정보 계층과 화면 전체 여백·정렬·섹션 간격을 최종 조정한다.
- PC/모바일 반응형 레이아웃을 최종 점검한다.
- hover / active / focus / disabled 등 인터랙션 상태를 통일한다.
- Excel 다운로드가 인앱 브라우저 환경에서 제한될 수 있으므로 하객 관리 화면에 필요 시 `다운로드가 되지 않는 경우 Chrome, Safari 등 다른 브라우저로 열어주세요.` 안내를 제공한다.
- 기능 로직은 불필요하게 변경하지 않고 UI/UX 완성도 향상에 집중한다.
- 진행 순서는 `⑩-C Quick Menu 2차 → ⑬-A 판매용 템플릿 확대 → ⑫-A/⑫-B 상품·이용권 → ⑬ 관리자 완성 → ⑬-B UI 최종 폴리싱 → ⑭ 실제 PG 결제`를 기준으로 한다.