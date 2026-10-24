// 종목명 오타 허용 매칭 — 스크린샷 OCR 오인식(한 글자 누락·치환 등) 보정용 공용 유틸

// 종목명 정규화 — 괄호·공백·기호 제거, 끝 줄임표(.) 제거, 소문자
export function normalizeStockName(name: string): string {
  return name
    .replace(/[()（）\s\-·&…]/g, "")
    .replace(/\.+$/, "")
    .toLowerCase();
}

// 길이별 허용 편집 거리 — 짧은 이름은 오매칭 위험이 커 퍼지 금지
export function fuzzyThreshold(len: number): number {
  if (len < 6) return 0;
  if (len < 12) return 1;
  return 2;
}

// Levenshtein 거리 — max 초과가 확정되면 max + 1로 조기 종료
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// 정규화된 입력과 허용 거리 이내로 가장 가까운 키들(최소 거리 동률 전부). exact(거리 0)는 호출부가 먼저 처리
export function findClosestNames(normalizedInput: string, normalizedKeys: Iterable<string>): string[] {
  const max = fuzzyThreshold(normalizedInput.length);
  if (max === 0) return [];
  let best = max + 1;
  let hits: string[] = [];
  for (const key of normalizedKeys) {
    const d = editDistance(normalizedInput, key, Math.min(max, best));
    if (d < best) { best = d; hits = [key]; }
    else if (d === best && d <= max) hits.push(key);
  }
  return best <= max ? hits : [];
}
