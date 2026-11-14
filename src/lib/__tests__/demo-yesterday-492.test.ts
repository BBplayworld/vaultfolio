// 4.92 #181 F2 — 체험 데모에 어제 일별 기록이 있어 홈 Hero가 'M/D 이후'가 아니라 '전일 대비'가 된다(C27).
// 홈 라벨 규칙: attr.fromDate === 어제 → 전일 대비 (dashboard.tsx, 코드 diff 0). 어제 기록이 시작점 후보가 되는지만 본다.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { materializeDemo } from "../preview/demo-payload";

const demoRaw = JSON.parse(readFileSync(path.resolve(__dirname, "../preview/demo-data.json"), "utf8"));
type P = { snapshots: { daily: Array<{ date: string; netAsset: number }> } };

describe("체험 데모 어제 기록", () => {
  it.each(["2026-11-12", "2026-12-01", "2027-03-01"])("%s 기준 어제 일별 기록이 있고 값은 D-2와 같거나 크다", (today) => {
    const daily = (materializeDemo(demoRaw, today) as unknown as P).snapshots.daily;
    const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    const twoAgo = new Date(Date.parse(`${today}T00:00:00Z`) - 2 * 86_400_000).toISOString().slice(0, 10);
    const y = daily.find((d) => d.date === yesterday);
    const t = daily.find((d) => d.date === twoAgo);
    expect(y).toBeTruthy();
    expect(y!.netAsset).toBeGreaterThanOrEqual(t!.netAsset);
    expect([...daily.map((d) => d.date)].sort().at(-1)).toBe(yesterday);
  });
});
