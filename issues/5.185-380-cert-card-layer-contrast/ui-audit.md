# 인증카드 레이어·콘텐츠 명도 조화 점검 (ui-designer, 2026-11-28)

- 대표 원문: "인증카드 회색 레이어와 컨텐츠의 완전 블랙의 조화가 일반 페이지들의 ui 디자인과 적합한지 점검. 대비 색상이 너무 눈에 띄긴해"
- 기준: 운영 main `0a20329e`. 로컬 `next build --webpack` + `?trial=1` 데모, 쿠키 `theme_mode`, 375·1280 × 다크·라이트. 운영 직접 접속 0회.
- 스크린샷: `screenshots/home-{theme}-{w}.png`, `cert-{투자유형|주식현황|포트폴리오}-{theme}-{w}.png`, 비교 견본 `swatch-current-A-B-C-dark.png`
  - 로컬은 외부 로고 이미지를 불러오지 못해 종목 아이콘이 깨진 아이콘으로 보인다. 이번 판정(면 색)과는 무관하다.

## 1. 결론
**문제 맞음, 다크 모드에서만.** 일반 페이지는 바닥보다 카드가 **밝게 떠오르는** 구조(bg L\*3.7 → card L\*10.1)인데, 인증카드 대화상자만 **회색 틀(popover L\*15.9) 안에 더 어두운 판(L\*3.7)이 꺼져 들어간** 역방향 구조다. 명도 차는 ΔL\* 12.2로, 일반 페이지의 면 간격(ΔL\* 6.4)보다 2배 가까이 크다. 그래서 "회색 띠 + 검은 판"이 따로 노는 것처럼 보인다. 라이트는 틀과 카드가 같은 색(#F0F2F4)이라 문제가 없다.

## 2. 실측 (computed style, 다크)
| 면 | 토큰·출처 | hex | L\* |
|---|---|---|---|
| 오버레이 합성(배경 위 `bg-black/70`) | dialog.tsx:41 | #030405 | 1.1 |
| 페이지 배경 | `--background` .16 | #0B0D12 | 3.7 |
| 일반 카드(홈 순자산 등) | `--card` .225 | #191C22 | 10.1 |
| **인증카드 대화상자 틀** | `dark:bg-popover` .275 (dialog.tsx:64) | **#24282F** | **15.9** |
| 제어 바 | `bg-muted/20` + `border-t border-b` (share-menu.tsx:367) | #262931 | 16.7 |
| **프리뷰 카드** | `bg-background` (share-card.tsx:369 responsive) | **#0B0D12** | **3.7** |
| 저장 PNG 배경 | `dark:bg-black` (share-card.tsx:369 캡처) | #000000 | 0 |

| 대비 | 값 | 판정 |
|---|---|---|
| 일반: card / bg | 1.13 (위로) | 기준 |
| 일반: popover / card | 1.15 (위로) | 기준 |
| **인증카드: 틀 popover / 프리뷰 bg** | **1.31 (아래로, 역방향)** | §1.1 "bg<card<popover" 순서 역전 |
| 제어 바 / 틀 | 1.02 | 면 구분은 헤어라인 2줄에 의존 |
| 프리뷰 bg / 저장 PNG #000 | 1.08 | 기존 의도(PNG만 순흑) |

단절 지점
1. **고도 역전**: §1.1 다크 고도 "bg < card < popover". 대화상자 속 콘텐츠가 틀보다 두 단계 낮은 bg로 내려간다. 앱 안에서 대화상자 안에 bg를 깐 곳은 이곳뿐이다(같은 패턴 다른 사용처 없음).
2. **선 과다**: 틀 `border`(white/10) + 제어 바 위·아래 선 + 프리뷰 둥근 모서리까지 겹쳐 선이 3겹이다. §3.3 "테두리보다 톤차"에 어긋난다.
3. **반경 비동심(1280)**: 틀은 `sm:rounded-lg`(12)인데 안쪽 카드는 `rounded-2xl`(20)이다. 안쪽 모서리가 더 둥글다(§3.2 위반, `cert-투자유형-dark-1280.png`).

## 3. 원인 코드
- `src/components/ui/dialog.tsx:64` DialogContent 공통 `bg-background dark:bg-popover`
- `src/app/(main)/_components/header-menu/share/share-menu.tsx:347` 인증카드 DialogContent(`border`, `sm:rounded-lg`)
- `.../share/share-menu.tsx:367` 제어 바 `border-t border-b bg-muted/20`
- `.../share/share-card.tsx:369` 프리뷰 `bg-background rounded-2xl` / 캡처 `bg-white dark:bg-black`

## 4. 개선안 비교 (견본: `screenshots/swatch-current-A-B-C-dark.png`)
| 안 | 틀 | 프리뷰 | 효과 | 단점 |
|---|---|---|---|---|
| 현행 | #24282F | #0B0D12 | — | 역방향, ΔL\* 12.2 |
| **A (권장)** | **#0B0D12**: share-menu.tsx:347에만 `dark:bg-background` | #0B0D12 그대로 | 틀과 카드가 한 면이 된다. 라이트(이미 한 면)와 같은 구조가 되고, 저장될 검은 카드를 그대로 미리 보여 준다. 대화상자 외곽은 `border` white/10이 맡는다(§3.3 프레임 외곽 허용). | 오버레이와 틀의 대비가 1.06이다. 외곽선은 지워선 안 된다. |
| B | #191C22 (`dark:bg-card`) | #0B0D12 | 역방향 폭이 절반(ΔL\* 6.4)으로 준다. | 역방향 구조는 그대로다. 대표 지적이 "덜해질" 뿐 없어지지 않는다. |
| C | #24282F 유지 | 투명(틀색) | 일반 대화상자와 같은 면이 된다. | 저장 PNG는 #000인데 미리보기는 회색이라 결과물과 다르게 보인다(WYSIWYG 상실). 비권장. |
| (D) 공용 `--popover` 하향 | — | — | 기각: §1.1 고도 체계가 깨지고 아래 5절의 화면 전부에 영향 | |

A 세부 지시(developer용, 범위 최소)
1. share-menu.tsx:347에 `dark:bg-background` 추가. tailwind-merge 덕분에 공통 `dark:bg-popover`가 무효화된다. `border`는 유지한다.
2. 제어 바(:367)는 `bg-muted/20`을 유지한다(bg 위에서 #121419, 1.06). 위아래 선은 그대로 둔다. 띠가 사라지면 조작부와 미리보기가 구분되지 않는다.
3. 프리뷰 카드는 바꾸지 않는다. 틀과 같은 색이라 모서리는 보이지 않으므로 반경 비동심도 시각적으로 해소된다.
4. 라이트는 diff 0이다(`dark:` 접두만 추가).

## 5. 저장 PNG 영향 (분리)
- 캡처 인스턴스는 자체 배경 `bg-white dark:bg-black`이 있고, `toPng`의 backgroundColor도 이 노드의 계산값을 쓴다(share-menu.tsx:160). 안 A·B는 DialogContent 배경만 바꾸므로 **PNG 배경색 변화 0, R32 바이트 동일성 영향 0**이다(share-card.tsx:369 캡처 분기를 건드리지 않는 것이 조건).
- 안 C·D도 PNG는 같다. 다만 C는 미리보기와 PNG가 달라진다.

## 6. 범위 판정 재료
- **안 A·B·C: 인증카드 대화상자 1곳**(share-menu.tsx). 다른 화면 영향 0, risk:low. 검수는 375·1280 × 다크·라이트 × 3타입.
- **공용 토큰을 바꾸면(dialog.tsx:64 또는 `--popover`) 영향 범위**:
  - DialogContent 사용 파일 33곳, AlertDialog 1곳, Sheet 2곳(`bg-background dark:bg-popover` 공통)
  - `--popover`를 바꾸면 Popover·Select 드롭다운, 자산 상세 증권사 타일 `subCard`(`dark:bg-popover`) 등 `bg-popover` 직접 사용 6파일과 FAB 시트까지 영향
  - 대화상자 안에 bg 면을 따로 까는 곳: notify-section, prompt-preview-dialog, floating-add-button, stock-screenshot-import, holdings-resync-dialog(부분 요소). 공용 토큰을 바꾸면 이 화면들도 함께 재검수해야 한다.
- 결론: 공용 토큰은 건드리지 않고 인증카드 셸만 국소 덮어쓰는 안 A를 권장한다. design-system §1.1 표의 "팝오버·시트·다이얼로그" 줄에 "예외: 인증카드 대화상자는 저장 카드와 한 면이 되도록 다크 `bg-background`"를 1줄 흡수하면 된다(신규 토큰 없음).

## 7. 수정 후 확인 항목 (qa 판정용)
1. 다크 375·1280: `[data-slot=dialog-content]` 계산 배경 = `oklch(0.16 0.01 265)`이고 프리뷰 카드 배경과 같다
2. 다크: 대화상자 외곽 `border-top-color` = white 10% 유지
3. 라이트 4장 스크린샷이 현행과 픽셀 동일하다(대화상자 영역)
4. 저장 PNG(다크·라이트 × 3타입) 바이트가 수정 전과 같다(R32)
5. 제어 바 `bg-muted/20`과 위아래 선이 유지된다
