import { describe, it, expect } from "vitest";
import { parseTradesXml, matchTrade, median, distinctAreas, type RealEstateTrade } from "../realestate-service";

// MOLIT 응답은 종류마다 필드가 다르다 — 아파트 태그만 읽으면 단독·비주거용 면적이 0이 되어
// 면적 필터가 무력화되고 시군구 전체 최근 거래가 잡히는 오매칭이 발생한다(S-4.21 AC8).
const wrap = (inner: string) => `<response><body><items><item>${inner}</item></items></body></response>`;

const APT_XML = wrap(`
  <aptNm>래미안퍼스티지</aptNm><excluUseAr>84.95</excluUseAr><dealAmount> 250,000 </dealAmount>
  <dealYear>2026</dealYear><dealMonth>5</dealMonth><dealDay>12</dealDay>
  <umdNm>반포동</umdNm><jibun>1234</jibun><floor>12</floor>
`);

const SH_XML = wrap(`
  <houseType>단독</houseType><totalFloorAr>180.5</totalFloorAr><plottageAr>210.3</plottageAr>
  <dealAmount>150,000</dealAmount><dealYear>2026</dealYear><dealMonth>4</dealMonth><dealDay>3</dealDay>
  <umdNm>정릉동</umdNm>
`);

const NRG_XML = wrap(`
  <buildingType>상업용</buildingType><buildingUse>제1종근린생활시설</buildingUse>
  <buildingAr>132.4</buildingAr><plottageAr>90.1</plottageAr>
  <dealAmount>240,000</dealAmount><dealYear>2026</dealYear><dealMonth>6</dealMonth><dealDay>20</dealDay>
  <umdNm>역삼동</umdNm><jibun>123-4</jibun><floor>1</floor>
`);

const trade = (o: Partial<RealEstateTrade> = {}): RealEstateTrade => ({
  complexName: "래미안퍼스티지",
  area: 84.95,
  areaKind: "exclusive",
  amount: 2_500_000_000,
  date: "2026-05-12",
  legalDong: "반포동",
  jibun: "1234",
  ...o,
});

describe("parseTradesXml — 데이터셋별 필드 매핑 (AC8)", () => {
  it("apt: 전용면적·단지명을 읽는다", () => {
    const [t] = parseTradesXml(APT_XML, "apt");
    expect(t.area).toBe(84.95);
    expect(t.areaKind).toBe("exclusive");
    expect(t.complexName).toBe("래미안퍼스티지");
    expect(t.amount).toBe(2_500_000_000);
    expect(t.date).toBe("2026-05-12");
  });

  it("sh: 연면적(totalFloorAr)을 읽는다 — excluUseAr는 존재하지 않는다", () => {
    const [t] = parseTradesXml(SH_XML, "sh");
    expect(t.area).toBe(180.5);
    expect(t.areaKind).toBe("gross");
    expect(t.complexName).toBe("단독");
  });

  it("nrg: 건물면적(buildingAr)·건물유형을 읽는다", () => {
    const [t] = parseTradesXml(NRG_XML, "nrg");
    expect(t.area).toBe(132.4);
    expect(t.areaKind).toBe("gross");
    expect(t.buildingType).toBe("상업용");
    expect(t.complexName).toBe("제1종근린생활시설");
  });

  it("nrg: 건물면적이 비면 대지면적으로 폴백하고 areaKind도 바뀐다", () => {
    const xml = wrap(`
      <buildingUse>사무소</buildingUse><buildingAr></buildingAr><plottageAr>90.1</plottageAr>
      <dealAmount>100,000</dealAmount><dealYear>2026</dealYear><dealMonth>6</dealMonth><dealDay>1</dealDay>
      <umdNm>역삼동</umdNm>
    `);
    const [t] = parseTradesXml(xml, "nrg");
    expect(t.area).toBe(90.1);
    expect(t.areaKind).toBe("plottage");
  });
});

describe("matchTrade — 오매칭 차단 (AC9)", () => {
  it("matchBy=area인데 면적을 모르면 추정하지 않는다", () => {
    const trades = [
      trade({ complexName: "제1종근린생활시설", area: 500, areaKind: "gross", legalDong: "역삼동", date: "2026-06-30" }),
      trade({ complexName: "사무소", area: 40, areaKind: "gross", legalDong: "삼성동", date: "2026-06-01" }),
    ];
    expect(matchTrade(trades, { matchBy: "area", legalDong: "역삼동" })).toBeNull();
  });

  it("면적 종류가 다르면 섞어서 비교하지 않는다", () => {
    const trades = [trade({ area: 130, areaKind: "plottage", legalDong: "역삼동" })];
    // gross만 요구 → plottage 후보는 제외되고, 표본도 부족해 추정 불가
    const r = matchTrade(trades, { matchBy: "area", legalDong: "역삼동", area: 130, areaKind: "gross" });
    expect(r).toBeNull();
  });
});

describe("matchTrade — 유사 거래 선정 (AC1)", () => {
  it("지번이 일치하면 최근 거래보다 우선하고 등급은 exact", () => {
    const trades = [
      trade({ jibun: "9999", date: "2026-06-30", amount: 9_000_000_000 }),
      trade({ jibun: "1234", date: "2026-01-10", amount: 2_400_000_000 }),
    ];
    const r = matchTrade(trades, { matchBy: "complex", complexName: "래미안퍼스티지", legalDong: "반포동", jibun: "1234", area: 84.95, areaKind: "exclusive" });
    expect(r?.amount).toBe(2_400_000_000);
    expect(r?.grade).toBe("exact");
  });

  it("면적 오차는 상대 10%(최소 3㎡)까지 허용한다", () => {
    const big = [trade({ area: 320, jibun: "", complexName: "상가", areaKind: "gross", legalDong: "역삼동" })];
    // 300㎡ 기준 ±30㎡ → 320은 후보
    expect(matchTrade(big, { matchBy: "area", legalDong: "역삼동", area: 300, areaKind: "gross" })?.area).toBe(320);
    // 400㎡ 기준 ±40㎡ → 320은 후보 밖 (표본 부족으로 폴백도 없음)
    expect(matchTrade(big, { matchBy: "area", legalDong: "역삼동", area: 400, areaKind: "gross" })).toBeNull();
  });

  it("소형 면적은 최소 ±3㎡가 보장된다", () => {
    const trades = [trade({ area: 22, areaKind: "gross", complexName: "사무소", legalDong: "역삼동", jibun: "" })];
    expect(matchTrade(trades, { matchBy: "area", legalDong: "역삼동", area: 20, areaKind: "gross" })?.area).toBe(22);
  });
});

describe("matchTrade — 단가 중앙값 폴백 (AC10)", () => {
  const sample = (area: number, amount: number, date: string) =>
    trade({ area, amount, date, areaKind: "gross", complexName: "제1종근린생활시설", legalDong: "역삼동", jibun: "" });

  it("표본 3건 미만이면 추정치를 내보내지 않는다", () => {
    // 면적 허용치(±10%) 밖이라 1단계는 실패하고, 폴백 표본은 2건뿐
    const trades = [sample(240, 4_000_000_000, "2026-05-01"), sample(250, 4_200_000_000, "2026-04-01")];
    expect(matchTrade(trades, { matchBy: "area", legalDong: "역삼동", area: 300, areaKind: "gross" })).toBeNull();
  });

  it("표본 3건 이상이면 ㎡당 단가 중앙값으로 환산한다", () => {
    const trades = [
      sample(240, 2_400_000_000, "2026-05-01"), // 1000만/㎡
      sample(250, 5_000_000_000, "2026-04-01"), // 2000만/㎡
      sample(260, 3_900_000_000, "2026-03-01"), // 1500만/㎡
    ];
    const r = matchTrade(trades, { matchBy: "area", legalDong: "역삼동", area: 300, areaKind: "gross" });
    expect(r?.grade).toBe("estimated");
    expect(r?.unitPrice).toBe(15_000_000);
    expect(r?.amount).toBe(4_500_000_000);
    expect(r?.sampleCount).toBe(3);
    expect(r?.date).toBeNull(); // 특정 거래일이 없다
  });
});

describe("median", () => {
  it("홀수 표본은 가운데 값", () => expect(median([3, 1, 2])).toBe(2));
  it("짝수 표본은 가운데 두 값의 평균", () => expect(median([4, 1, 3, 2])).toBe(2.5));
  it("빈 배열은 0", () => expect(median([])).toBe(0));
});

describe("distinctAreas", () => {
  it("단지명이 맞는 거래의 면적만 오름차순으로 모은다", () => {
    const trades = [
      trade({ area: 84.95 }),
      trade({ area: 59.9 }),
      trade({ area: 84.95 }),
      trade({ complexName: "다른단지", area: 120 }),
    ];
    expect(distinctAreas(trades, "래미안퍼스티지")).toEqual([59.9, 85]);
  });
});
