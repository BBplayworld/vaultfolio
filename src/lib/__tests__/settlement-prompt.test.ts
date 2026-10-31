// #54 결산 AI 질문 — 프롬프트 순수 함수·GA 값·복사 헬퍼
import { describe, expect, it, vi } from "vitest";
import { buildSettlementPrompt, type SettlementPromptInput } from "../ai-prompts";
import { formatPriceByMode } from "../number-utils";
import { labelOf, PARAM_VALUES } from "../analytics/ga";
import { copyPrompt } from "@/app/(main)/_components/layout/ui/prompt-preview-dialog";

const base: SettlementPromptInput = {
  name: "10월", rangeLabel: "9/28 → 10/28", kind: "settled", longGap: false, gapDays: 30,
  prevValue: 612_340_000, currValue: 625_910_000, delta: 13_570_000, pct: 2.2,
  causes: [
    { key: "price", amount: 8_200_000, estimated: false },
    { key: "income", amount: 3_000_000, estimated: false },
    { key: "loan", amount: -450_000, estimated: true },
    { key: "unrecorded", amount: 2_820_000, estimated: false },
  ],
  estimatedLabel: "예측",
};
const GUARD_END = "관점에서만 분석해 주세요.\n";
const bodyOf = (p: string) => p.slice(p.indexOf(GUARD_END) + GUARD_END.length);

describe("1. 화면 값만 그대로", () => {
  const p = buildSettlementPrompt(base);
  it("시작·끝·증감·%·원인 라벨과 금액을 화면 표기 그대로 담는다", () => {
    for (const v of [base.prevValue, base.currValue]) expect(p).toContain(formatPriceByMode(v));
    expect(p).toContain(`+${formatPriceByMode(base.delta)} (+2.2%)`);
    expect(p).toContain(`시세 변동: +${formatPriceByMode(8_200_000)}`);
    expect(p).toContain(`순유입: +${formatPriceByMode(3_000_000)}`);
    expect(p).toContain(`대출: ${formatPriceByMode(-450_000)} (예측)`);
    expect(p).toContain(`기록 안 된 변화: +${formatPriceByMode(2_820_000)}`);
    expect(p).toContain("[10월 순자산 변화 — 9/28 → 10/28]");
  });
  it("본문의 금액 토큰은 모두 입력에서 나온 표기다(새 금액 생성 없음)", () => {
    let body = bodyOf(p);
    const tokens = [base.prevValue, base.currValue, base.delta, ...base.causes.map((c) => c.amount)].map((v) => formatPriceByMode(v));
    for (const t of tokens.sort((a, b) => b.length - a.length)) body = body.split(t).join("");
    expect(body).not.toMatch(/\d\s*(원|만|억)/); // 입력 표기를 지운 뒤 남는 금액 0
  });
  it("요청 문구의 달은 화면 이름 그대로(지난달 보기에서 '이번 달' 오기 없음)", () => {
    expect(p).toContain("무엇이 10월 순자산을 바꿨는지");
    expect(p).not.toContain("이번 달");
  });});

describe("2. 금지 문구·기록 안 된 변화 설명", () => {
  it("가드레일 밖 본문에 투자 권유 문구 없음", () => {
    const body = bodyOf(buildSettlementPrompt(base));
    for (const w of ["매수", "매도", "추천해", "사야", "팔아야", "목표가", "수익률 예측", "리밸런싱", "비중을 늘", "비중을 줄"]) {
      expect(body).not.toContain(w);
    }
  });
  it("가드레일(매수·매도 부정 지시)은 맨 앞에 그대로", () => {
    expect(buildSettlementPrompt(base).startsWith("[중요 — 이 도구는 개인 자산")).toBe(true);
  });
  it("'기록 안 된 변화' 설명 1줄", () => {
    const p = buildSettlementPrompt(base);
    expect(p.match(/'기록 안 된 변화'는 새로 등록한 자산/g)?.length).toBe(1);
  });
});

describe("3. 상황별 안내", () => {
  it("원인 0건", () => {
    expect(buildSettlementPrompt({ ...base, causes: [] })).toContain("뚜렷한 원인 항목이 없음");
  });
  it("예측 라벨 그대로(일부 예측)", () => {
    expect(buildSettlementPrompt({ ...base, estimatedLabel: "일부 예측" })).toContain("(일부 예측)");
  });
  it("진행 중·긴 간격", () => {
    const p = buildSettlementPrompt({ ...base, kind: "in_progress", longGap: true, gapDays: 62 });
    expect(p).toContain("진행 중 구간");
    expect(p).toContain("62일 구간");
    expect(buildSettlementPrompt(base)).not.toContain("진행 중 구간");
  });
  it("증감률 없음이면 % 생략", () => {
    expect(buildSettlementPrompt({ ...base, pct: null })).not.toMatch(/\(\+?-?\d+\.\d%\)/);
  });
});

describe("4. GA 값·라벨", () => {
  it("추가 값 4개와 한글 라벨", () => {
    expect(PARAM_VALUES.category).toContain("ai_prompt");
    expect(PARAM_VALUES.method).toContain("prompt_copy");
    expect(PARAM_VALUES.source).toContain("settlement");
    expect(PARAM_VALUES.source).toContain("report");
    expect(labelOf("category", "ai_prompt")).toBe("AI 프롬프트");
    expect(labelOf("method", "prompt_copy")).toBe("프롬프트 복사");
    expect(labelOf("source", "settlement")).toBe("결산 화면");
    expect(labelOf("source", "report")).toBe("자산 성적표");
  });
});

describe("5. copyPrompt", () => {
  it("쓰기 성공 → onSuccess·onCopy 각 1회", async () => {
    const onCopy = vi.fn(); const onSuccess = vi.fn(); const onFail = vi.fn();
    expect(await copyPrompt("q", async () => {}, { onCopy, onSuccess, onFail })).toBe(true);
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onFail).not.toHaveBeenCalled();
  });
  it("쓰기 실패 → onCopy 0회, onFail 1회", async () => {
    const onCopy = vi.fn(); const onFail = vi.fn();
    expect(await copyPrompt("q", async () => { throw new Error("denied"); }, { onCopy, onFail })).toBe(false);
    expect(onCopy).not.toHaveBeenCalled();
    expect(onFail).toHaveBeenCalledTimes(1);
  });
  it("onCopy 미지정이어도 동작", async () => {
    const write = vi.fn(async () => {});
    await expect(copyPrompt("q", write)).resolves.toBe(true);
    expect(write).toHaveBeenCalledWith("q");
  });
});
