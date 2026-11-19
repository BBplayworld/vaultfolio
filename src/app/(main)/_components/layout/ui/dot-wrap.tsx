// 줄바꿈되는 메타 줄의 가운뎃점(#245, design-system §11) — flex-wrap 줄에 조각을 덧붙일 때 줄 머리·줄 끝에 `·`가 남지 않게 한다.
// 가운뎃점을 '앞 조각 뒤'가 아니라 '뒤 조각의 머리'(12px 자리)에 두고, 줄을 왼쪽으로 8px 당긴 뒤 그 8px를 잘라 낸다.
// 같은 줄에 이어지면 조각 사이(gap 4px + 8px)에 점이 보이고, 조각이 다음 줄로 내려가면 점은 잘린 자리에 들어가 보이지 않는다.
// 쓰는 법: 줄에 DOT_WRAP_ROW(+ flex flex-wrap gap-x-1), 첫 조각에 DOT_WRAP_FIRST, 둘째 조각부터 맨 앞에 <DotLead />.
// 점은 실제 글자라 textContent에는 `A · B`로 남는다(검사·복사 시 문장 그대로).

/** 줄 — 왼쪽 8px만 자른다(위·아래·오른쪽은 넉넉히 열어 둔다) */
export const DOT_WRAP_ROW = "-ml-2 [clip-path:inset(-2px_-100vw_-2px_0.5rem)]";
/** 첫 조각 — 당긴 8px만큼 되돌린다 */
export const DOT_WRAP_FIRST = "ml-2";

/** 둘째 조각부터 맨 앞에 두는 가운뎃점 */
export function DotLead() {
  return <span aria-hidden className="-ml-1 inline-block w-3 text-center font-normal text-muted-foreground">{" · "}</span>;
}
