# DearDay Quick Menu / Bottom Sheet 운영 TC

> 날짜: 2026-09-22
> 대상: 공개 `/invite/[slug]`
> 상태: 주요 UI/기능 TC 완료, 전체 출시 회귀 TC에서 재확인

## A. Quick Menu 노출

- [x] 최초 접속 시 Quick Menu가 보이지 않는다.
- [x] 초대장 중간 스크롤에서는 보이지 않는다.
- [x] 실제 최하단 trigger 도달 시 Quick Menu가 나타난다.
- [x] 한 번 나타난 후 위로 스크롤해도 fixed 상태를 유지한다.
- [x] 새로고침하면 다시 숨김 상태로 시작한다.
- [x] 최하단 `Thank you` 콘텐츠가 Quick Menu에 가려지지 않는다.

## B. 버튼 구성

- [x] RSVP 활성 시 `참석 여부` 표시.
- [x] 장소 데이터가 있으면 `오시는 길` 표시.
- [x] 방명록 활성 시 `축하 메시지` 표시.
- [ ] 각 기능 OFF 조합 전체 회귀 TC — 출시 전 재확인.

## C. RSVP Bottom Sheet

- [x] `참석 여부` 클릭 시 Bottom Sheet가 열린다.
- [x] 최대 높이가 화면 전체를 완전히 덮지 않고 원래 초대장이 일부 보인다.
- [x] 긴 폼은 Sheet 내부에서 스크롤된다.
- [x] RSVP 제출이 정상 동작한다.
- [x] 제출 완료 상태가 정상 표시된다.
- [x] `참석 여부 수정하기`는 Secondary Action 디자인으로 표시된다.
- [x] `수정 링크 복사`는 Primary Action 디자인으로 표시된다.
- [x] 템플릿 색상과 action 색상이 통일된다.
- [ ] 수정 링크 실제 재진입/수정 전체 회귀 TC — 기존 RSVP 기능 TC에서 완료했으며 출시 전 재확인.

## D. Guestbook Bottom Sheet

- [x] `축하 메시지` 클릭 시 Bottom Sheet가 열린다.
- [x] RSVP Sheet와 동일한 높이/라운드/색상 정책을 사용한다.
- [x] 입력 폼과 등록 버튼이 정상 표시된다.
- [x] 템플릿 색상이 적용된다.
- [ ] 등록 → 즉시 목록 반영 → 비밀번호 삭제 성공/실패 — 기존 방명록 기능 TC 완료, 출시 전 Quick Menu 경로로 재확인.
- [ ] 소유자 삭제 Dialog stacking 회귀 확인.

## E. Location

- [ ] `오시는 길` 클릭 후 Classic 장소 섹션 이동 재확인.
- [ ] Modern 장소 섹션 이동 재확인.
- [ ] Romantic 장소 섹션 이동 재확인.
- [ ] reduced-motion 환경에서 auto scroll 재확인.

## F. Theme / Colors

- [x] Spring Blossom/Classic 계열에서 gold/베이지 계열 통일 확인.
- [x] Colors Config의 button/accent/divider 값이 Quick Menu/Sheet에 반영되는 구조 확인.
- [ ] Config 없는 Classic fallback 운영 확인.
- [ ] Config 없는 Modern fallback 운영 확인.
- [ ] Config 없는 Romantic fallback 운영 확인.
- [ ] Colors Config 변경 후 Quick Menu/Sheet 동시 변경 회귀 확인.

## G. 닫기 / 접근성 / 모바일

- [x] Sheet 상단 닫기 버튼 표시.
- [x] backdrop dim 표시.
- [x] Sheet 내부 스크롤 구조 확인.
- [ ] backdrop 클릭 닫기 재확인.
- [ ] Esc 닫기 재확인.
- [ ] body scroll lock 재확인.
- [ ] 390px 실제 모바일 폭 회귀 확인.
- [ ] 540px 폭 회귀 확인.
- [ ] safe-area-inset-bottom 기기 회귀 확인.

## H. 알려진 해결 이력

- 초기 trigger가 너무 위에 있어 첫 화면에서 Quick Menu가 즉시 나타나던 문제 해결.
- trigger 이동 과정에서 남은 `triggerRef` 때문에 발생한 `useRef is not defined` 공개 초대장 런타임 오류 해결.
- RSVP 완료 후 `참석 여부 수정하기`에 coral 고정색이 남아 템플릿 색상과 충돌하던 문제 해결.
- Bottom Sheet가 화면 전체를 덮어 새 페이지처럼 보이던 문제를 최대 `90dvh` 정책으로 개선.
- fixed Quick Menu가 마지막 콘텐츠를 가릴 가능성을 하단 약 76px 여백으로 개선.

## I. 완료 판정

Quick Menu + RSVP/Guestbook Bottom Sheet의 핵심 UX는 구현 및 배포 완료로 본다. 남은 체크 항목은 신규 기능 개발이 아니라 출시 전 전체 통합/회귀 TC에서 확인한다.
