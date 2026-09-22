# DearDay Spring Blossom / Template Editor TC — 2026-09-22

> 대상: 관리자 Draft Template Config 및 공통 InvitationRenderer

## PASS 체크

- [x] Draft Live Preview 기본 렌더링
- [x] 전체 미리보기 기본 렌더링
- [x] Hero Text Y 위치 조정
- [x] Hero 표시 항목 8종 ON/OFF
- [x] 표시 항목 저장 후 새로고침 복원
- [x] `photo` mode: 대표사진 O / Frame X
- [x] `frame` mode: 대표사진 O / Frame O
- [x] `illustration` mode: 대표사진 X / Background O / Frame 설정 시 O
- [x] 대표사진 Zoom 1.0 미만 축소 허용
- [x] Zoom 축소 시 Hero Background 노출
- [x] Hero Background → 대표사진 → Overlay/Frame → Hero Text 레이어 확인
- [x] Classic configured Hero legacy dark gradient 제거
- [x] Config Overlay opacity 0에서 사진 원래 밝기 확인
- [x] Screen Effect 낙하 효과 확인
- [x] 390px Preview
- [x] 540px Preview
- [x] 전체 미리보기에 현재 선택 폭 전달

## Hero Display Config

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

누락 필드는 기존 표시 동작을 유지하며 명시적 `false`만 숨김 처리한다.

## Hero Mode 기대값

| Mode | 대표사진 | Background | Frame | Overlay/Text |
|---|---|---|---|---|
| photo | O | O | X | O |
| frame | O | O | O | O |
| illustration | X | O | 설정 시 O | O |
| 기존 mode 없음 | 기존 동작 | 기존 동작 | 기존 동작 | 기존 동작 |

## Zoom 기준

- 허용 범위: `0.5 ~ 2.0`
- step: `0.05`
- 0.8 = 80%
- 1.0 = 100%
- 1.2 = 120%

## Preview 기준

- 390px 선택 상태에서 전체 미리보기 390px 적용
- 540px 선택 상태에서 전체 미리보기 540px 적용
- 실제 viewport가 좁으면 max-width 100%로 보호
- Draft Live Preview / 전체 미리보기 / Public은 가능한 한 동일 `InvitationRenderer` 사용

## 회귀 확인 대상

- 기존 `hero.display` 없는 Version
- 기존 `hero.mode` 없는 Version
- Hero Background 없는 Version
- Config 없는 기존 Classic legacy gradient
- Modern / Romantic 기존 디자인
- Version pinning
- Public Renderer 데이터 경로
- Hero Text Y
- Screen Effect
- Safe Area
- BGM

## Spring Blossom 최종 시각 확인

대표사진 + 꽃 Hero Frame 조합에서 Classic legacy gradient 제거 후 Hero 하단의 불필요한 어두운 영역이 사라졌고, 사진/Frame/Background가 자연스럽게 연결되는 것을 확인했다.

향후 다른 판매 템플릿에서도 동일 TC를 기본 회귀 체크리스트로 재사용한다.
