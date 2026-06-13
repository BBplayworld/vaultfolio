/**
 * /api/sync  (공개 E2EE 금고)
 *
 * 인증: 헤더 `x-sync-auth` = base64url(JSON { assetId, ts, nonce, sig }).
 *   sig = Ed25519.sign(canonical, privKey). 서버는 assetId로 pubKey 조회 후 검증 + ts 신선도(±5분).
 *   금고암호·privKey·encKey·평문은 서버로 오지 않는다. 서버 저장 = pubKey + 암호문뿐(제로지식).
 *
 * GET            canonical "GET|assetId|ts|nonce"            → { vault } (pubKey 제외)
 * GET ?meta=1    canonical "GET|assetId|ts|nonce"            → { version }
 * PUT            canonical "PUT|assetId|baseVersion|sha256(ciphertext)|ts|nonce"
 *                body { iv, ciphertext, baseVersion, pubKey? } → 신규 TOFU 등록 / 기존 검증·version+1
 */

import { NextResponse } from "next/server";
import { getVault, setVault } from "@/lib/cloud-sync/sync-storage";
import { SYNC_AUTH_HEADER, SIG_FRESHNESS_SEC, type VaultEnvelope } from "@/lib/cloud-sync/config";
import { fromBase64, sha256Hex, verifySignature } from "@/lib/cloud-sync/crypto";
import { getCacheStorage } from "@/lib/cache-storage";

interface AuthToken { assetId: string; ts: number; nonce: string; sig: string }

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    "unknown"
  );
}

function parseAuth(request: Request): AuthToken | null {
  const raw = request.headers.get(SYNC_AUTH_HEADER);
  if (!raw) return null;
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(fromBase64(b64));
    const t = JSON.parse(json) as AuthToken;
    if (!t.assetId || typeof t.ts !== "number" || !t.nonce || !t.sig) return null;
    return t;
  } catch {
    return null;
  }
}

function freshTs(ts: number): boolean {
  return Math.abs(Date.now() / 1000 - ts) <= SIG_FRESHNESS_SEC;
}

const MAX_CIPHERTEXT = 4 * 1024 * 1024; // 4MB 상한(남용 방지)

export async function GET(request: Request) {
  const auth = parseAuth(request);
  if (!auth || !freshTs(auth.ts)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const vault = await getVault(auth.assetId);
  if (!vault) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const canonical = `GET|${auth.assetId}|${auth.ts}|${auth.nonce}`;
  const ok = await verifySignature(canonical, auth.sig, fromBase64(vault.pubKey));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  if (searchParams.get("meta") === "1") {
    return NextResponse.json({ version: vault.version, updatedAt: vault.updatedAt });
  }
  return NextResponse.json({ vault: { iv: vault.iv, ciphertext: vault.ciphertext, version: vault.version } });
}

export async function PUT(request: Request) {
  const auth = parseAuth(request);
  if (!auth || !freshTs(auth.ts)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 쓰기 남용 방지(IP 기반, 로컬은 항상 통과)
  if (!(await getCacheStorage().checkRateLimit(getClientIp(request)))) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  let body: { iv?: string; ciphertext?: string; baseVersion?: number; pubKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const { iv, ciphertext, baseVersion, pubKey } = body;
  if (!iv || !ciphertext || typeof baseVersion !== "number") {
    return NextResponse.json({ error: "암호문/버전 누락" }, { status: 400 });
  }
  if (ciphertext.length > MAX_CIPHERTEXT) {
    return NextResponse.json({ error: "데이터가 너무 큽니다." }, { status: 413 });
  }

  const ctHash = await sha256Hex(ciphertext);
  const canonical = `PUT|${auth.assetId}|${baseVersion}|${ctHash}|${auth.ts}|${auth.nonce}`;

  const current = await getVault(auth.assetId);

  // 검증 키: 기존 금고는 저장된 pubKey, 신규(TOFU)는 body.pubKey
  const verifyPubKey = current?.pubKey ?? pubKey;
  if (!verifyPubKey) return NextResponse.json({ error: "pubKey 필요(최초 등록)" }, { status: 400 });
  const ok = await verifySignature(canonical, auth.sig, fromBase64(verifyPubKey));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 기존 금고: pubKey 교체 불가(현 키 서명으로만), 낙관적 동시성
  if (current) {
    if (pubKey && pubKey !== current.pubKey) {
      return NextResponse.json({ error: "pubKey 변경 불가" }, { status: 403 });
    }
    if (current.version > baseVersion) {
      return NextResponse.json({ error: "conflict", vault: { version: current.version } }, { status: 409 });
    }
  }

  const envelope: VaultEnvelope = {
    pubKey: current?.pubKey ?? verifyPubKey,
    iv,
    ciphertext,
    version: (current?.version ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  await setVault(auth.assetId, envelope);
  return NextResponse.json({ version: envelope.version });
}
