// 업로드 이미지 가로·세로 판독(PNG·JPEG·WEBP) — 인식 전 '너무 작은 이미지' 가드용(#109).
// 헤더만 읽고, 모든 접근은 버퍼 경계를 검사한다. 판독 실패·HEIC·미지원은 null(= 가드 통과, 현행대로 Gemini 호출).
// 판독한 크기·바이트는 로그·저장하지 않는다.

/** 긴 변이 이 값 미만이면 화면 목록이 담길 수 없는 이미지로 본다 */
export const MIN_LONG_SIDE = 200;

export interface ImageSize { width: number; height: number }

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const tag = (b: Uint8Array, i: number, s: string) => {
  for (let k = 0; k < s.length; k++) if (b[i + k] !== s.charCodeAt(k)) return false;
  return true;
};

function pngSize(b: Uint8Array): ImageSize | null {
  if (b.length < 24 || !tag(b, 12, "IHDR")) return null;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

function jpegSize(b: Uint8Array): ImageSize | null {
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    while (i < b.length && b[i] === 0xff) i++; // 채움 바이트
    const m = b[i];
    i++;
    if (m === undefined) return null;
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) continue; // 길이 없는 마커
    if (m === 0xd9 || m === 0xda) return null; // EOI·SOS: 크기 정보 없이 데이터 시작
    if (i + 2 > b.length) return null;
    const len = u16be(b, i);
    if (len < 2) return null;
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      if (i + 7 > b.length) return null; // len(2) + 정밀도(1) + 높이(2) + 너비(2)
      return { width: u16be(b, i + 5), height: u16be(b, i + 3) };
    }
    i += len;
  }
  return null;
}

function webpSize(b: Uint8Array): ImageSize | null {
  if (b.length < 30 || !tag(b, 0, "RIFF") || !tag(b, 8, "WEBP")) return null;
  const d = 20; // 첫 청크 데이터 시작
  if (tag(b, 12, "VP8 ")) {
    if (b[d + 3] !== 0x9d || b[d + 4] !== 0x01 || b[d + 5] !== 0x2a) return null;
    return { width: u16le(b, d + 6) & 0x3fff, height: u16le(b, d + 8) & 0x3fff };
  }
  if (tag(b, 12, "VP8L")) {
    if (b[d] !== 0x2f) return null;
    const bits = (b[d + 1] | (b[d + 2] << 8) | (b[d + 3] << 16) | (b[d + 4] << 24)) >>> 0;
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (tag(b, 12, "VP8X")) {
    return { width: u24le(b, d + 4) + 1, height: u24le(b, d + 7) + 1 };
  }
  return null;
}

/** 크기를 읽지 못하면(HEIC·손상·미지원) null */
export function readImageSize(bytes: Uint8Array, mime: string): ImageSize | null {
  try {
    if (mime === "image/png") return pngSize(bytes);
    if (mime === "image/jpeg") return jpegSize(bytes);
    if (mime === "image/webp") return webpSize(bytes);
  } catch {
    return null;
  }
  return null;
}

/** 가로·세로 모두 MIN_LONG_SIDE 미만(긴 변 < 200px)이면 true. 판독 실패는 false */
export function isTinyImage(bytes: Uint8Array, mime: string): boolean {
  const s = readImageSize(bytes, mime);
  if (!s || s.width <= 0 || s.height <= 0) return false;
  return Math.max(s.width, s.height) < MIN_LONG_SIDE;
}
