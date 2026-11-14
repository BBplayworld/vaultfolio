import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openSecret, sealSecret } from "../crypto";

const env = { ...process.env };
beforeEach(() => {
  process.env.PUSH_STORE_KEY = Buffer.alloc(32, 5).toString("base64");
});
afterEach(() => {
  process.env = { ...env };
});

describe("저장 블롭 암복호화(R2)", () => {
  const secret = { endpoint: "https://fcm.googleapis.com/fcm/send/x", p256dh: "p", auth: "a" };
  it("왕복", () => {
    expect(openSecret(sealSecret(secret))).toEqual(secret);
  });
  it("짧은 블롭·잘린 태그·변조·다른 키는 null", () => {
    expect(openSecret("")).toBeNull();
    expect(openSecret(Buffer.alloc(27).toString("base64"))).toBeNull();
    expect(openSecret(Buffer.alloc(28).toString("base64"))).toBeNull(); // 암호문 0바이트
    const buf = Buffer.from(sealSecret(secret), "base64");
    buf[buf.length - 1] ^= 1;
    expect(openSecret(buf.toString("base64"))).toBeNull();
    const blob = sealSecret(secret);
    process.env.PUSH_STORE_KEY = Buffer.alloc(32, 9).toString("base64");
    expect(openSecret(blob)).toBeNull();
  });
});
