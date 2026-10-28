// 정적 배포 .ics(public/calendar) = buildSettlementIcs(SETTLEMENT_ICS_STAMP) 고정 + RFC 5545 형식(C19)
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildSettlementIcs, SETTLEMENT_ICS_PATH, SETTLEMENT_ICS_STAMP } from "../settlement";

const file = readFileSync("public/calendar/secretasset-monthly-settlement.ics", "utf8");

describe("정적 .ics 배포본", () => {
  it("버튼 경로가 이 파일을 가리킨다", () => {
    expect(SETTLEMENT_ICS_PATH).toBe("/calendar/secretasset-monthly-settlement.ics");
  });
  it("생성 함수 결과와 바이트 단위로 같다(재생성 누락 방지)", () => {
    expect(file).toBe(buildSettlementIcs(SETTLEMENT_ICS_STAMP));
  });
  it("RFC 5545 — CRLF·VEVENT 1개·월말 반복·21:00 KST·75옥텟·금액 없음", () => {
    expect(file.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(file.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(file.replace(/\r\n/g, "")).not.toMatch(/\n|\r/);
    expect(file.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(file).toContain("RRULE:FREQ=MONTHLY;BYMONTHDAY=-1");
    expect(file).toMatch(/DTSTART:\d{8}T120000Z/);
    expect(file).not.toMatch(/원|₩|\d,\d{3}/);
    for (const line of file.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});
