import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createCipheriv, createHmac, randomBytes } from "crypto";
import { getStoreKey, isLegacyBlob, openSecret, pushSubId, pushSubIdLegacy, sealSecret } from "../crypto";

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
    const buf = Buffer.from(sealSecret(secret).slice(2), "base64");
    buf[buf.length - 1] ^= 1;
    expect(openSecret("2:" + buf.toString("base64"))).toBeNull();
    const blob = sealSecret(secret);
    process.env.PUSH_STORE_KEY = Buffer.alloc(32, 9).toString("base64");
    expect(openSecret(blob)).toBeNull();
  });
});

describe("5.113 HKDF 키 분리·구 형식 이중 읽기", () => {
  const secret = { endpoint: "https://fcm.googleapis.com/fcm/send/x", p256dh: "p", auth: "a" };
  const legacySeal = (s: typeof secret) => {
    const key = getStoreKey()!;
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
    const ct = Buffer.concat([c.update(JSON.stringify(s), "utf8"), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
  };

  it("신규 블롭은 2: 접두 + 파생 키, 왕복 성공", () => {
    const blob = sealSecret(secret);
    expect(blob.startsWith("2:")).toBe(true);
    expect(isLegacyBlob(blob)).toBe(false);
    expect(openSecret(blob)).toEqual(secret);
  });

  it("구 형식(접두 없음·마스터 키 직접)도 읽힌다", () => {
    const old = legacySeal(secret);
    expect(isLegacyBlob(old)).toBe(true);
    expect(openSecret(old)).toEqual(secret);
  });

  it("키 분리: 신 블롭은 마스터 키 직접 복호화 불가, 접두를 떼고 구 경로로 읽어도 실패", () => {
    const blob = sealSecret(secret);
    expect(openSecret(blob.slice(2))).toBeNull();
  });

  it("신 subId는 구 subId와 다르고(HKDF 분리) 결정적이며 구 값은 마스터 HMAC과 일치", () => {
    const ep = "https://fcm.googleapis.com/fcm/send/abc";
    expect(pushSubId(ep)).toBe(pushSubId(ep));
    expect(pushSubId(ep)).toMatch(/^[0-9a-f]{64}$/);
    expect(pushSubId(ep)).not.toBe(pushSubIdLegacy(ep));
    expect(pushSubIdLegacy(ep)).toBe(createHmac("sha256", getStoreKey()!).update(ep).digest("hex"));
  });
});
