import { describe, expect, it } from "vitest";
import { reconcileImagePrices, reconcilePrices, type PriceRowInput } from "../price-consistency";

describe("reconcilePrices (2줄 헤더 평단·현재가 정합)", () => {
  it("수익률과 맞으면 유지", () => {
    expect(reconcilePrices(120, 100, 20)).toEqual({ currentPrice: 120, averagePrice: 100, action: "keep" });
  });
  it("값이 바뀌어 읽히면 교정 (양수 수익률)", () => {
    expect(reconcilePrices(100, 120, 20)).toEqual({ currentPrice: 120, averagePrice: 100, action: "swap" });
  });
  it("음수 수익률 유지", () => {
    expect(reconcilePrices(40, 100, -60)).toEqual({ currentPrice: 40, averagePrice: 100, action: "keep" });
  });
  it("음수 수익률에서 바뀌어 읽히면 교정", () => {
    expect(reconcilePrices(100, 40, -60)).toEqual({ currentPrice: 40, averagePrice: 100, action: "swap" });
  });
  it("수수료 수준의 오차는 유지", () => {
    expect(reconcilePrices(104.4, 100, 4.0).action).toBe("keep");
  });
  it("둘 다 안 맞으면 평단을 비우고 추정 경로", () => {
    expect(reconcilePrices(120, 100, -30)).toEqual({ currentPrice: 120, averagePrice: 0, action: "estimate" });
  });
  it("수익률 없음·값 없음은 검증하지 않고 유지", () => {
    expect(reconcilePrices(120, 100, 0).action).toBe("keep");
    expect(reconcilePrices(0, 100, 5).action).toBe("keep");
    expect(reconcilePrices(120, 0, 5).action).toBe("keep");
  });
  it("현재가≈평단 보합은 유지", () => {
    expect(reconcilePrices(100.5, 100, 0.5).action).toBe("keep");
  });

  describe("2차 근거 (5.0)", () => {
    // 현재가 90·평단 100을 바르게 읽고 수익률 부호만 빠져 +10으로 읽힌 경우(C102)
    it("부호 누락 + 평가금액÷수량이 현재가 쪽 → keep", () => {
      const r = reconcilePrices(90, 100, 10, { quantity: 10, currentValue: 900, profitAmount: -100 });
      expect(r).toEqual({ currentPrice: 90, averagePrice: 100, action: "keep" });
    });
    it("부호 누락 + 평가금액 없음 + 손익 부호 반대 → keep", () => {
      expect(reconcilePrices(90, 100, 10, { quantity: 10, profitAmount: -100 }).action).toBe("keep");
    });
    it("부호 누락 + 근거 전혀 없음 → 4.99 동작(swap) 유지", () => {
      expect(reconcilePrices(90, 100, 10).action).toBe("swap");
      expect(reconcilePrices(90, 100, 10, {}).action).toBe("swap");
    });
    it("진짜 2줄 헤더 swap: 평가금액÷수량이 swap 쪽 → swap", () => {
      const r = reconcilePrices(100, 120, 20, { quantity: 10, currentValue: 1200, profitAmount: 200 });
      expect(r).toEqual({ currentPrice: 120, averagePrice: 100, action: "swap" });
    });
    it("진짜 swap + 손익 부호 일치(평가금액 없음) → swap", () => {
      expect(reconcilePrices(100, 120, 20, { quantity: 10, profitAmount: 200 }).action).toBe("swap");
    });
    it("음수 수익률 swap: 부호 일치 → swap, 부호 반대 → keep", () => {
      expect(reconcilePrices(100, 40, -60, { profitAmount: -600 }).action).toBe("swap");
      expect(reconcilePrices(100, 40, -60, { profitAmount: 600 }).action).toBe("keep");
    });
    it("수량 미인식이면 E1 생략 (평가금액 무시)", () => {
      // quantity 미전달: 평가금액만으로는 판정하지 않으므로 4.99 동작
      expect(reconcilePrices(90, 100, 10, { currentValue: 900 }).action).toBe("swap");
    });
    it("원화 표시 해외주식: 원화 평가금액÷수량으로도 판정", () => {
      const r = reconcilePrices(135000, 150000, 11, { quantity: 2, currentValue: 270000 });
      expect(r).toEqual({ currentPrice: 135000, averagePrice: 150000, action: "keep" });
    });
    it("통화가 달라 평가금액÷수량이 어느 쪽에도 안 맞으면 근거 없음", () => {
      // 가격은 USD, 평가금액은 KRW → E1 없음 → 수익률 판정(swap)
      expect(reconcilePrices(100, 120, 20, { quantity: 10, currentValue: 1_650_000 }).action).toBe("swap");
    });
  });

  describe("소수익률 뒤바뀜 교정 (C)", () => {
    // AVGO: 현재가 345.00, 평단 342.06, +0.86%
    it("바뀐 읽기(현재가↔평단) + 평가금액÷수량이 swap 쪽에 맞음 → swap", () => {
      const r = reconcilePrices(342.06, 345, 0.86, { quantity: 10, currentValue: 3450, profitAmount: 29.4 });
      expect(r).toEqual({ currentPrice: 345, averagePrice: 342.06, action: "swap" });
    });
    it("바른 읽기 → keep", () => {
      const r = reconcilePrices(345, 342.06, 0.86, { quantity: 10, currentValue: 3450 });
      expect(r.action).toBe("keep");
    });
    it("평가손익 없으면 평가금액이 맞아도 소수익률은 건드리지 않음(4.99 동작)", () => {
      expect(reconcilePrices(342.06, 345, 0.86, { quantity: 10, currentValue: 3450 }).action).toBe("keep");
    });
    it("평가금액 없으면 소수익률은 건드리지 않음", () => {
      expect(reconcilePrices(342.06, 345, 0.86).action).toBe("keep");
    });
    it("수수료 근처 0%: 둘 다 0.2% 이내로 맞으면 근거 없음 → keep", () => {
      expect(reconcilePrices(100.1, 100, 0.1, { quantity: 10, currentValue: 1000.5 }).action).toBe("keep");
      expect(reconcilePrices(100, 100.1, -0.1, { quantity: 10, currentValue: 1000.5 }).action).toBe("keep");
    });
    it("0.2% 초과 오차(합계 반올림 등)는 교정하지 않음", () => {
      expect(reconcilePrices(342.06, 345, 0.86, { quantity: 10, currentValue: 3470 }).action).toBe("keep");
    });
  });

  describe("평가금액 오독 방어 (qa D1)", () => {
    it("반례: 평가금액 칸에 매입금액이 들어와도 바른 읽기를 뒤집지 않음", () => {
      expect(reconcilePrices(130, 100, 30, { quantity: 10, currentValue: 1000 }).action).toBe("keep");
      expect(reconcilePrices(80, 100, -20, { quantity: 10, currentValue: 1000 }).action).toBe("keep");
    });
    it("퍼징: 바른 읽기 + 매입금액으로 오독된 평가금액 → 잘못된 swap 없음", () => {
      let seed = 12345;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      for (let i = 0; i < 2000; i++) {
        const avg = 10 + rnd() * 990;
        const rate = (rnd() * 2 - 1) * 60; // -60~+60%
        const cur = avg * (1 + rate / 100);
        const q = 1 + Math.floor(rnd() * 100);
        const ev = { quantity: q, currentValue: avg * q, profitAmount: (cur - avg) * q };
        const r = reconcilePrices(cur, avg, rate, ev);
        expect(r.action === "swap").toBe(false);
      }
    });
    it("퍼징: 평가손익 없음 + 매입금액으로 오독된 평가금액 → swap 0건", () => {
      let seed = 777;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      for (let i = 0; i < 2000; i++) {
        const avg = 10 + rnd() * 990;
        const rate = (rnd() * 2 - 1) * 60;
        const cur = avg * (1 + rate / 100);
        const q = 1 + Math.floor(rnd() * 100);
        const r = reconcilePrices(cur, avg, rate, { quantity: q, currentValue: avg * q });
        expect(r.action).not.toBe("swap");
      }
    });
    it("부호 누락 + 매입금액 오독 평가금액 + 손익 있음 → keep", () => {
      expect(reconcilePrices(90, 100, 10, { quantity: 10, currentValue: 1000, profitAmount: -100 }).action).toBe("keep");
    });
  });

  describe("수익률 비율 표기 (미래에셋형 합성 표)", () => {
    it("수익률이 0.0839(=8.39%)처럼 비율로 읽혀도 화면 평단을 유지", () => {
      const ev = { quantity: 10, currentValue: 108800, profitAmount: 8420 };
      expect(reconcilePrices(10880, 10038, 0.0839, ev)).toEqual({ currentPrice: 10880, averagePrice: 10038, action: "keep" });
      expect(reconcilePrices(10880, 10038, 0.0839, { profitAmount: 8420 }).action).toBe("keep"); // 평가손익만 있어도 지지
      expect(reconcilePrices(10880, 10038, 0.0839, { quantity: 10, currentValue: 108800 }).action).toBe("estimate"); // 평가금액만으로는 지지 안 함
      expect(reconcilePrices(10880, 10038, -0.0839, ev).action).not.toBe("keep"); // 부호 반대는 맞지 않음
    });
    it("비율 표기 + 부호 누락 + 가격 뒤바뀜(근거 반대)은 keep하지 않고 estimate", () => {
      const r = reconcilePrices(10000, 9000, 0.1, { quantity: 10, currentValue: 90000, profitAmount: -10000 });
      expect(r.action).toBe("estimate");
    });
    it("비율 표기 + 평가금액÷수량이 현재가 쪽(정상 읽기, 부호 있음) → keep", () => {
      expect(reconcilePrices(10880, 10038, 0.0839, { quantity: 10, currentValue: 108800, profitAmount: 8420 }).action).toBe("keep");
    });
    it("퍼징: 비율 표기 + 가격 뒤바뀜 + 올바른 평가금액·평가손익 → keep 아님", () => {
      let seed = 4242;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      for (let i = 0; i < 1000; i++) {
        const avg = 10 + rnd() * 990;
        const rate = (rnd() * 0.5 + 0.05) * (rnd() < 0.5 ? -1 : 1); // 5~55% 손익
        const cur = avg * (1 + rate);
        const q = 1 + Math.floor(rnd() * 100);
        // AI가 가격을 뒤바꿔 읽고 비율 표기(부호 누락)한 경우
        const r = reconcilePrices(avg, cur, Math.abs(rate), { quantity: q, currentValue: cur * q, profitAmount: (cur - avg) * q });
        expect(r.action).not.toBe("keep");
      }
    });
    it("평가금액을 매입금액으로 오독 + 3중 오류 + 평가손익 없음 → estimate", () => {
      expect(reconcilePrices(10000, 9000, 0.1, { quantity: 10, currentValue: 100000 }).action).toBe("estimate");
    });
    it("퍼징: 평가손익 없음 + 가격 뒤바뀜·비율 표기 + 임의 평가금액 → 라벨 없는 keep 0건", () => {
      let seed = 31337;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      for (let i = 0; i < 2000; i++) {
        const avg = 10 + rnd() * 990;
        const rate = rnd() * 0.5 + 0.05;
        const cur = avg * (1 + rate);
        const q = 1 + Math.floor(rnd() * 100);
        const v = [avg * q, cur * q, avg * q * 1.1][Math.floor(rnd() * 3)];
        expect(reconcilePrices(avg, cur, rate, { quantity: q, currentValue: v }).action).not.toBe("keep");
      }
    });
    it("근거 전무(평가손익·평가금액 없음)면 비율 표기라도 keep하지 않고 estimate (60e72d6 동작)", () => {
      expect(reconcilePrices(10000, 9000, 0.1, undefined).action).toBe("estimate");
      expect(reconcilePrices(10000, 9000, 0.1, { quantity: 10 }).action).toBe("estimate");
    });
    it("퍼징: 근거 전무 + 가격 뒤바뀜·비율 표기 → 라벨 없는 keep 0건", () => {
      let seed = 99;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      for (let i = 0; i < 2000; i++) {
        const avg = 10 + rnd() * 990;
        const rate = (rnd() * 0.5 + 0.05);
        const cur = avg * (1 + rate);
        expect(reconcilePrices(avg, cur, rate).action).not.toBe("keep");
      }
    });
    it("비율로도 안 맞으면 기존대로 추정 경로", () => {
      expect(reconcilePrices(120, 100, 0.5).action).toBe("estimate");
    });
  });
});

// 가공 숫자. 키움형: 현재가 위/평균단가 아래. AI가 한 이미지를 통째로 바꿔 읽은 경우
const trueRows = [
  { cur: 400, avg: 330, rate: 21.2, pa: 3000 },
  { cur: 160, avg: 150, rate: 6.67, pa: 400 },
  { cur: 130, avg: 135, rate: -3.7, pa: -90 }, // 수익률 -3.7: asIs 오차 0 / swapped 약 3.85 -> asIs 명확
  { cur: 360.98, avg: 357.88, rate: 0.86, pa: 21 }, // 소수익률: 방향 애매
];
const asRows = (swap: boolean): PriceRowInput[] =>
  trueRows.map((t) => ({
    currentPrice: swap ? t.avg : t.cur,
    averagePrice: swap ? t.cur : t.avg,
    profitRate: t.rate,
    evidence: { profitAmount: t.pa },
  }));

describe("reconcileImagePrices (이미지 단위 위치 일관)", () => {
  it("통째로 바꿔 읽힌 이미지: 소수익률 행도 같은 방향으로 교정", () => {
    const out = reconcileImagePrices(asRows(true));
    expect(out.map((o) => [o.currentPrice, o.averagePrice])).toEqual(trueRows.map((t) => [t.cur, t.avg]));
  });
  it("개별 판정만으로는 소수익률 행이 그대로(근거 확인)", () => {
    const r = asRows(true)[3];
    expect(reconcilePrices(r.currentPrice, r.averagePrice, r.profitRate, r.evidence).action).toBe("keep");
  });
  it("바르게 읽힌 이미지는 아무 행도 바뀌지 않음", () => {
    const out = reconcileImagePrices(asRows(false));
    expect(out.every((o) => o.action === "keep")).toBe(true);
  });
  it("표 부족(swap 행 1개)·동률이면 현행 유지", () => {
    const rows = asRows(true);
    const out1 = reconcileImagePrices([rows[0], rows[3]]);
    expect(out1[1].action).toBe("keep");
    const mixed = [...asRows(true).slice(0, 2), ...asRows(false).slice(2, 3), asRows(true)[3]];
    const out2 = reconcileImagePrices(mixed);
    expect(out2[3].action).toBe("keep");
  });
  it("평가손익 부호가 swap과 모순이면 그 행은 유지", () => {
    const rows = asRows(true);
    rows[3] = { ...rows[3], evidence: { profitAmount: -21 } }; // 읽은 그대로(cur<avg)와 부호 같음 -> swap 모순
    expect(reconcileImagePrices(rows)[3].action).toBe("keep");
  });
  it("C102 퍼징: 바르게 읽힌 이미지(평가손익 포함)는 새로 뒤집지 않는다", () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    for (let n = 0; n < 20000; n++) {
      const count = 2 + Math.floor(rnd() * 7);
      const rows: PriceRowInput[] = [];
      for (let k = 0; k < count; k++) {
        const avg = 10 + rnd() * 500;
        const rate = rnd() < 0.4 ? (rnd() - 0.5) * 4 : (rnd() - 0.5) * 80;
        const cur = avg * (1 + rate / 100);
        const qty = 1 + Math.floor(rnd() * 100);
        const pa = (cur - avg) * qty;
        // 일부 행은 수익률 부호 누락(C102)
        const signed = rnd() < 0.3 ? Math.abs(rate) : rate;
        // 근거(평가손익·수량·평가금액)가 일부 행에서 빠지는 경우도 섞는다(5.101 qa D-1)
        const ev = rnd() < 0.5 ? { quantity: qty, profitAmount: pa } : rnd() < 0.5 ? {} : { quantity: qty, currentValue: cur * qty };
        rows.push({ currentPrice: cur, averagePrice: avg, profitRate: signed, evidence: ev });
      }
      const out = reconcileImagePrices(rows);
      out.forEach((o, i) => {
        const single = reconcilePrices(rows[i].currentPrice, rows[i].averagePrice, rows[i].profitRate, rows[i].evidence);
        // 이미지 단위 처리가 행별 결과에서 새로 swap을 만들지 않는다
        if (single.action !== "swap") expect(o.action).not.toBe("swap");
      });
    }
  });
  it("D-1: 평가손익이 없는 소수익률 행은 다수결을 적용하지 않는다", () => {
    const rows = asRows(true);
    rows[3] = { ...rows[3], evidence: {} };
    expect(reconcileImagePrices(rows)[3].action).toBe("keep");
  });
  it("D-2: 평가금액÷수량이 읽은 그대로와 맞으면 다수결로 덮지 않는다", () => {
    const rows = asRows(true);
    // 읽은 그대로: cur=357.88 → 평가금액 = 357.88*7
    rows[3] = { ...rows[3], evidence: { profitAmount: 21, quantity: 7, currentValue: 357.88 * 7 } };
    expect(reconcileImagePrices(rows)[3].action).toBe("keep");
  });
});
