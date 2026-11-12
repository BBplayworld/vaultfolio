// 푸시 저장소 키 접두어 — preview·운영이 같은 Redis를 쓰므로 환경별로 분리한다(#179).
// 접두어는 서버 환경 변수에서만 계산한다(클라이언트 입력 금지).
export function pushKeyPrefix(): string {
  const env = process.env.VERCEL_ENV;
  return `push:${env === "production" ? "prod" : env === "preview" ? "preview" : "dev"}:`;
}
