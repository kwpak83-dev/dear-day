# DearDay 공개 초대장 Quick Menu / Bottom Sheet 구현 기록

> 업데이트: 2026-09-22
> 상태: 구현·배포·주요 운영 TC 완료
> 대상: 공개 `/invite/[slug]` 초대장

## 1. 목적

공개 초대장에서 RSVP와 방명록이 긴 인라인 섹션으로 계속 이어지던 구조를 개선한다. 하객이 초대장 본문을 먼저 자연스럽게 감상한 뒤 필요한 기능에 빠르게 접근할 수 있도록, 최하단 도달 후 나타나는 고정 Quick Menu와 Bottom Sheet 구조를 사용한다.

## 2. 최종 UX

- 최초 진입 시 Quick Menu는 보이지 않는다.
- 초대장 전체 Renderer 뒤 최하단 trigger가 viewport에 진입하면 Quick Menu가 아래에서 나타난다.
- 한 번 나타난 Quick Menu는 같은 페이지 방문 동안 위로 다시 스크롤해도 화면 하단에 fixed 상태로 유지한다.
- 새로고침하면 다시 숨김 상태에서 시작한다.
- Quick Menu는 활성 기능에 따라 `참석 여부`, `오시는 길`, `축하 메시지` 버튼을 표시한다.
- RSVP와 방명록은 공개 초대장에서 긴 인라인 섹션 대신 Bottom Sheet로 연다.
- 오시는 길은 기존 템플릿의 장소/지도 섹션으로 이동한다.
- 관리자 Draft Preview와 사용자 LIVE Preview는 기존 Preview 보호 정책을 유지한다.

## 3. Quick Menu 표시 조건

- RSVP: `rsvpEnabled === true`일 때 표시.
- 방명록: `guestbookEnabled !== false`일 때 표시.
- 오시는 길: 장소 데이터가 있을 때 표시.
- Template Sections에서 해당 기능이 비활성화된 경우 대응 Quick Menu 버튼도 숨긴다.
- 실제 trigger는 `InvitationRenderer` 전체가 끝난 뒤 공개 초대장 최하단에 둔다.
- trigger가 viewport에 약 10% 이상 진입하면 메뉴를 표시한다.

## 4. Bottom Sheet 공통 정책

- RSVP와 방명록은 동일한 Bottom Sheet UI를 사용한다.
- backdrop dim, 상단 handle, 제목, 닫기 버튼을 제공한다.
- 바깥 영역 클릭과 Esc 키로 닫을 수 있다.
- Sheet가 열리면 body 스크롤을 잠근다.
- 내용이 길면 Sheet 내부만 스크롤한다.
- 모바일에서 최대 높이는 `90dvh` 이내이며 화면 상단에 최소 약 56px이 남도록 해 원래 초대장이 일부 보이게 한다.
- safe-area를 고려한다.
- 방명록 삭제 Dialog는 Sheet보다 위에 표시되도록 stacking을 유지한다.

## 5. 기존 기능 재사용

### RSVP
- 기존 `RsvpForm`을 그대로 Bottom Sheet 안에서 사용한다.
- 비회원 제출, 행사 시작 후 마감, 개인 수정 링크, 동일 브라우저 edit token 복원 등 기존 기능을 변경하지 않는다.
- 제출 완료 후 `참석 여부 수정하기`와 `수정 링크 복사`를 제공한다.

### 방명록
- 기존 `Guestbook`의 조회·등록·삭제 로직을 그대로 사용한다.
- 이름, 메시지, 숫자 4자리 삭제 비밀번호 구조를 유지한다.
- 소유자/작성자 삭제 정책과 API는 변경하지 않는다.

### 오시는 길
- Classic / Modern / Romantic의 기존 장소 섹션으로 이동한다.
- reduced-motion 설정이 없을 때만 smooth scroll을 사용한다.

## 6. 템플릿 색상 연동

Quick Menu와 Bottom Sheet를 DearDay 공통 고정색으로 보이지 않게 하고 현재 초대장 템플릿 디자인의 일부처럼 보이게 한다.

Colors Config가 있으면 아래 기존 변수를 우선 사용한다.

- `--dd-color-button-bg`
- `--dd-color-button-text`
- `--dd-color-accent`
- `--dd-color-divider`

새 색상 Config 필드는 추가하지 않는다.

Config가 없는 경우 템플릿 기존 fallback을 사용한다.

- Classic: gold 계열, transparent/pill 계열 디자인.
- Modern: ink 계열, transparent/각진 디자인.
- Romantic: rose 주요색 + gold 보조 포인트.
- Spring Blossom: Classic 형태를 사용하되 저장된 Colors Config가 있으면 해당 값이 최우선이다.

색상 연동 대상:
- Quick Menu 배경/글자/아이콘/구분선의 주요 포인트.
- Bottom Sheet handle/header/닫기 및 선택 상태의 포인트.
- RSVP 주요 제출 버튼.
- 방명록 등록·삭제 주요 버튼.
- RSVP 완료 화면 action 버튼.

## 7. RSVP 완료 화면 버튼 정책

RSVP 제출 후 두 action의 역할을 시각적으로 구분한다.

- `참석 여부 수정하기`: Secondary Action. 투명 배경 + 현재 템플릿 accent 테두리/글자.
- `수정 링크 복사`: Primary Action. 현재 템플릿 button background + button text.

기존 coral 하드코딩이 템플릿 색상과 섞여 대비가 깨지는 문제를 제거했다.

## 8. 최하단 콘텐츠 보호

Quick Menu가 fixed로 유지되므로 공개 초대장 마지막 `Thank you` 콘텐츠를 가리지 않도록 하단에 Quick Menu 높이와 safe area를 고려한 약 76px 여백을 확보한다.

Quick Menu의 위치, 등장 조건, fixed 동작, animation은 변경하지 않는다.

## 9. 구현 중 수정한 주요 문제

### 최초 trigger 위치 문제
초기 구현에서는 trigger가 Quick Menu/Optional Section 내부 위치를 기준으로 감지되어 초대장을 열자마자 메뉴가 표시되는 문제가 있었다. trigger를 전체 `InvitationRenderer` 뒤 실제 공개 초대장 최하단으로 이동해 해결했다.

### `useRef is not defined` 런타임 오류
trigger 이동 후 기존 내부 trigger 코드와 `triggerRef`가 남아 있었으나 `useRef` import는 제거되어 공개 초대장이 로드되지 않는 런타임 오류가 발생했다. 더 이상 사용하지 않는 `triggerRef`와 내부 trigger span을 제거하고 `page.js` 최하단 실제 trigger만 유지해 복구했다.

### 템플릿 색상 불일치
Quick Menu와 Bottom Sheet에 DearDay 공통색/coral이 남아 템플릿과 이질감이 있었다. 기존 Colors Config CSS 변수와 Classic/Modern/Romantic fallback을 재사용하도록 수정했다.

## 10. 관련 구현 파일

- `app/invite/[slug]/page.js`
- `app/invite/[slug]/invitation-quick-menu.js`
- `app/invite/[slug]/optional-invitation-sections.js`
- `app/invite/[slug]/rsvp-form.js` — 기존 기능 구조 확인, 기능 로직은 유지
- `app/invite/[slug]/guestbook.js` — 기존 기능 재사용
- `app/globals.css`

RSVP/방명록 API 계약, DB 구조, migration, 패키지는 이번 Quick Menu 작업에서 변경하지 않았다.

## 11. 운영 TC 결과

2026-09-22 배포 환경에서 다음을 확인했다.

- 최초 화면 Quick Menu 미노출: 정상.
- 중간 스크롤 Quick Menu 미노출: 정상.
- 최하단 도달 시 Quick Menu 등장: 정상.
- 등장 후 위로 스크롤 시 fixed 유지: 정상.
- Spring Blossom 계열 공개 초대장에서 기존 gold/베이지 계열과 Quick Menu 색상 통일: 정상.
- RSVP Bottom Sheet 열기: 정상.
- RSVP 제출: 정상.
- RSVP 제출 완료 상태 표시: 정상.
- RSVP 완료 화면 Secondary/Primary action 색상 구분: 정상.
- Guestbook Bottom Sheet 표시: 정상.
- Bottom Sheet 최대 높이 및 뒤 초대장 일부 노출: 정상.
- Bottom Sheet 내부 스크롤 구조: 정상.
- 최하단 `Thank you` 콘텐츠와 Quick Menu 간 여백: 정상.

방명록 등록·삭제 및 오시는 길 이동은 기존 기능을 재사용하며, 최종 출시 전 전체 통합 TC에서 다시 회귀 확인한다.

## 12. 유지보수 원칙

- Quick Menu 기능 때문에 RSVP/방명록 API 또는 DB를 별도 구현하지 않는다.
- 템플릿별 Quick Menu 전용 HEX를 새로 하드코딩하지 않는다.
- 템플릿 Colors Config가 있으면 해당 값이 항상 우선한다.
- 공개 초대장의 핵심 콘텐츠 감상 흐름을 방해하지 않도록 Quick Menu는 최하단 도달 전 노출하지 않는다.
- 향후 버튼 문구/기능을 확장할 때도 Template Sections ON/OFF와 실제 데이터 존재 여부를 함께 반영한다.
- Preview와 Public 동작 차이를 의도적으로 유지하는 경우 회귀 TC에 명시한다.
