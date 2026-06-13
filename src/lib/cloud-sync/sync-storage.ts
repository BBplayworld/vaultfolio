/**
 * cloud-sync/sync-storage.ts  (서버 전용)
 * 암호화 금고 blob 저장소 — 환경 자동 감지(로컬 파일 / Vercel Upstash).
 * assetId로 주소화. 저장 내용은 pubKey + 암호문(VaultEnvelope)뿐(제로지식).
 */

import * as fs from "fs";
import * as path from "path";
import { Redis } from "@upstash/redis";
import type { VaultEnvelope } from "./config";

const FILE_PATH = path.join(process.cwd(), "data", "cloud-sync.json");

interface FileShape {
  vaults: Record<string, VaultEnvelope>;
}

function redisEnabled(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });
  }
  return redis;
}

function readFile(): FileShape {
  try {
    if (!fs.existsSync(FILE_PATH)) return { vaults: {} };
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf8")) as FileShape;
  } catch {
    return { vaults: {} };
  }
}

function writeFile(data: FileShape): void {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function getVault(assetId: string): Promise<VaultEnvelope | null> {
  if (redisEnabled()) {
    return (await getRedis().get<VaultEnvelope>(`csync:vault:${assetId}`)) ?? null;
  }
  return readFile().vaults[assetId] ?? null;
}

export async function setVault(assetId: string, envelope: VaultEnvelope): Promise<void> {
  if (redisEnabled()) {
    await getRedis().set(`csync:vault:${assetId}`, envelope);
    return;
  }
  const data = readFile();
  data.vaults[assetId] = envelope;
  writeFile(data);
}
