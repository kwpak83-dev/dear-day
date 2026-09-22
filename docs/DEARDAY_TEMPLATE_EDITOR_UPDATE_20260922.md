# DearDay 템플릿 편집기 업데이트 — 2026-09-22

> 목적: Spring Blossom 실전 템플릿 검증 과정에서 확정·구현한 Hero/Preview/Effects 동작과 운영 TC 기준을 기록한다.
> 관련 기준 문서: `DEARDAY_REQUIREMENTS.md`, `DEARDAY_TEMPLATE_SPEC.md`, `DEARDAY_GAP.md`

## 1. 이번 작업 범위

Spring Blossom을 기준으로 관리자 Draft Config → 실제 `InvitationRenderer` → 전체 미리보기 흐름을 점검하고 Hero 편집 기능을 실전 판매 템플릿 수준으로 보강했다.

핵심 변경 범위:
- Hero Text Y 위치 조정
- Hero 표시 항목 개별 ON/OFF
- Draft Live Preview / 전체 미리보기 390px·540px 폭 처리
- Hero Mode 실제 Renderer 분기
- 대표사진 Zoom 축소 허용
- Hero Background / 대표사진 / Frame 레이어 구조 보강
- Classic legacy gradient와 Config Overlay 충돌 제거
- Screen Effect 실제 시각 TC

## 2. Hero 표시 항목

관리자 Hero 설정에서 다음 8개 항목을 개별 표시/숨김할 수 있다.

```js
hero.display = {
  eyebrow: true,
  eventLabel: true,
  title: true,
  relations: true,
  detail: true,
  note: true,
  schedule: true,
  venue: true
}
```

운영 원칙:
- `hero.display` 또는 개별 필드가 없는 기존 Version은 기존처럼 표시한다.
- 명시적으로 `false`인 항목만 숨긴다.
- 기존 판매/Public 초대장의 기본 결과를 깨뜨리지 않는다.
- 템플릿에 원래 존재하지 않던 Hero 요소를 새로 추가하지 않는다.
- Hero Text Y 설정과 동시에 적용할 수 있다.

Spring Blossom 실전 검증에서는 불필요한 웨딩 전용 문구를 숨기고 행사 제목/이름과 일정 등 필요한 항목만 남길 수 있음을 확인했다. 이 구조는 웨딩뿐 아니라 돌잔치·생일·파티 등 공통 템플릿 활용성을 높이기 위한 것이다.

## 3. Hero Mode 실제 동작

Config 저장값:
- 사진 중심형: `hero.mode = "photo"`
- 컨셉 프레임형: `hero.mode = "frame"`
- 포스터/일러스트형: `hero.mode = "illustration"`

현재 Renderer 정책:

### photo
- 대표사진 표시
- Hero Frame 미표시
- Hero Background 유지
- Overlay / Hero Text 유지

### frame
- 대표사진 표시
- Hero Frame 표시
- Hero Background 유지
- Overlay / Hero Text 유지

### illustration
- 대표사진 숨김
- Hero Background를 메인 비주얼로 사용
- 설정된 Hero Frame 표시
- Overlay / Hero Text 유지

호환성:
- mode가 없는 기존 Version은 기존 대표사진/Frame 조건을 유지한다.
- Classic / Modern / Romantic 모두 동일한 mode 정책을 사용한다.
- 각 템플릿의 기존 JSX/디자인 구조는 유지한다.

## 4. 대표사진 Zoom

기존 Zoom 최소값 1.0 때문에 사진 확대만 가능하고 축소가 불가능했던 제한을 수정했다.

현재 범위:
- 최소: `0.5`
- 최대: `2.0`
- step: `0.05`

예:
- `0.8` = 80% 축소
- `1.0` = 기존 크기
- `1.2` = 120% 확대

적용:
- `photo`: 적용
- `frame`: 적용
- `illustration`: 대표사진이 숨겨지므로 시각적 영향 없음

사진 X/Y 위치 설정은 기존 방식 그대로 유지한다.

## 5. Hero 레이어 구조

Hero Background Asset이 설정되어 있어도 기존 figure의 불투명 fallback 배경 때문에 Zoom 1 미만에서 Background가 가려지는 문제가 있었다.

현재 의도된 레이어 순서:

`Hero Background → 대표사진 → Config Overlay → Hero Frame → Hero Text`

추가로 Screen Effect는 Hero 내부 고정 레이어가 아니라 전체 초대장 연출 레이어로 취급한다.

Hero Background URL이 정상 해석된 경우 Hero media 영역의 fallback 배경을 투명 처리하여 축소된 대표사진 주변으로 Background가 보이도록 한다.

Hero Background Asset이 없는 기존 Version은 기존 템플릿 fallback 배경을 유지한다.

## 6. Classic legacy gradient 처리

Classic에는 기존 `.classic-hero figure::after` 하드코딩 gradient가 존재했다. 이 gradient는 관리자 Config Overlay와 별개로 항상 적용되어 Hero 하단을 어둡게 만들었다.

현재 정책:
- `.dd-template-hero-configured`가 적용된 Classic Hero에서는 legacy `figure::after` gradient를 숨긴다.
- Config Hero에서는 `hero.overlayColor` + `hero.overlayOpacity`만 시각 Overlay로 사용한다.
- Overlay opacity가 `0`이면 사진과 Hero Background를 원래 밝기로 표시한다.
- Config가 없는 기존 Classic은 legacy gradient를 그대로 유지한다.
- Modern / Romantic에는 Classic 전용 처리의 영향을 주지 않는다.

Spring Blossom 운영 화면에서 하단의 불필요한 어두운 gradient가 제거되고 사진/꽃 Frame이 자연스럽게 표시되는 것을 확인했다.

## 7. Draft Preview 폭

관리자 Draft Live Preview의 390px / 540px 선택값은 전체 미리보기에도 동일하게 전달되어야 한다.

현재 정책:
- 기존 Preview `width` state를 재사용한다.
- 별도 width state를 추가하지 않는다.
- 전체 미리보기 툴바 제목, Preview 폭, Renderer 지도 key 등에 현재 선택 폭을 사용한다.
- 좁은 실제 브라우저 화면에서는 `maxWidth: 100%`로 viewport를 넘지 않는다.

운영 TC:
- 390px 선택 → 전체 미리보기 390px
- 540px 선택 → 전체 미리보기 540px
- 폭 전환 후 Hero/Frame/Background/Effects 결과 일치 확인

## 8. Screen Effect

Spring Blossom에서는 꽃잎 계열 Screen Effect를 실제 Preview에서 검증했다.

확인 항목:
- 효과 Asset 선택
- 표시 개수
- 최소/최대 크기
- 최소/최대 낙하 시간
- 좌우 흔들림
- 투명도
- 회전 사용

효과는 본문 가독성과 조작을 방해하지 않는 은은한 수준을 기본으로 한다.

BGM은 기존 공통 정책과 별도로 유지하며 이번 Hero 수정 범위에서 변경하지 않았다.

## 9. Safe Area

기존 Safe Area Top / Right / Bottom / Left 설정을 유지한다. 이번 Hero Mode, Zoom, Background/Frame 변경으로 Safe Area 동작을 재정의하지 않는다.

## 10. Spring Blossom 실전 TC 결과

확인 완료 또는 작업 과정에서 검증한 항목:
- Hero 표시 항목 ON/OFF 저장 및 복원
- 제목/일정 등 필요한 항목만 표시 가능
- Hero Text Y 적용
- `photo` / `frame` / `illustration` 모드별 시각 차이
- Zoom 1 미만 축소
- 축소 시 Hero Background가 사진 뒤에 노출
- Frame이 대표사진 위 레이어로 표시
- Classic Config Hero의 legacy dark gradient 제거
- Config Overlay opacity 0에서 원본 밝기 유지
- Screen Effect 은은한 낙하 효과
- Draft Live Preview와 전체 미리보기 공통 Renderer 사용
- 390px / 540px Preview 폭 전달

## 11. 회귀 보호 원칙

이번 기능은 다음 기존 정책을 유지해야 한다.
- Version pinning 변경 금지
- 기존 Public Renderer 데이터 경로 변경 금지
- mode/display 값이 없는 기존 Version fallback 유지
- 기존 Asset 없는 템플릿 fallback 유지
- 기존 Classic의 Config 미사용 초대장은 legacy 디자인 유지
- Modern / Romantic에 Classic 전용 gradient 수정 영향 없음
- DB migration이 필요하지 않은 Config 확장으로 유지

## 12. 주요 구현 파일 기록

이번 작업에서 직접 관련된 파일:
- `app/admin/templates/template-versions.js`
- `app/admin/templates/template-draft-preview.js`
- `app/api/admin/templates/versions/route.js`
- `lib/template-config.js`
- `components/invitation/template-config-render.js`
- `components/invitation/templates/classic-template.js`
- `components/invitation/templates/modern-template.js`
- `components/invitation/templates/romantic-template.js`
- `app/globals.css`

## 13. 다음 템플릿 작업 기준

후속 판매 템플릿에서는 먼저 관리자 Config로 해결 가능한지 확인한다.

특히 Hero는 다음 순서로 구성한다.
1. Hero Mode 선택
2. Hero Background Asset 선택
3. 대표사진 Zoom/X/Y 조정
4. 필요 시 Hero Frame 적용
5. Hero 표시 항목 선택
6. Hero Text Y 조정
7. Config Overlay 조정
8. Screen Effect / Safe Area 확인
9. 390px / 540px Draft Preview 확인
10. 전체 미리보기 확인

새 Renderer capability가 필요한 경우에만 코드 수정한다.
