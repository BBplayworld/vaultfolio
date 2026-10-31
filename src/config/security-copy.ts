// 보안 안내 문구 단일 출처(#61) — 웰컴 보안 상세·앱가이드 카드·동기화 메뉴·스크린샷 업로드 박스가 참조한다.
// 텍스트만 둔다(React·아이콘 import 없음). 아이콘은 각 화면이 id로 매핑한다.

// 대표 확인 대기: '이중 암호화' 표현 — 바꿀 때는 이 블록만 교체(4.38 #61 design-final 대안 참조)
const DUAL_ENCRYPTION_COPY = {
  syncCardTitle: "이중 암호화 동기화",
  // '저장·전송' 가운뎃점 앞뒤 \u2060(WORD JOINER) — "저장· / 전송" 줄바꿈 방지(C25)
  syncCardDesc: "동기화를 켜면 자산이 기기에서 이중으로 암호화된 뒤 전송돼요. 금고 암호는 저장\u2060·\u2060전송되지 않아요.",
  adminCardDesc: "동기화한 자산은 이중 암호화돼 있어 관리자도 내용을 알 수 없어요. 금고 암호를 잊으면 복구할 수 없어요.",
  appGuideDesc: "자산은 내 기기에 저장되고, 동기화는 이중 암호화로 보호돼요.",
  syncMenuDesc: "동기화한 자산은 이중 암호화돼 관리자도 알 수 없어요. 금고 암호가 있어야 열 수 있어요.",
} as const;

export type SecurityCopyId = "local" | "sync" | "admin";

/** 보안 특징 카드 3개 — 웰컴 보안 상세와 앱가이드가 같은 값을 렌더한다 */
export const SECURITY_COPY: readonly { id: SecurityCopyId; title: string; desc: string }[] = [
  { id: "local", title: "내 기기에 저장", desc: "자산 데이터는 동기화를 켜지 않는 한 이 기기의 브라우저에만 저장돼요." },
  { id: "sync", title: DUAL_ENCRYPTION_COPY.syncCardTitle, desc: DUAL_ENCRYPTION_COPY.syncCardDesc },
  { id: "admin", title: "관리자도 알 수 없어요", desc: DUAL_ENCRYPTION_COPY.adminCardDesc },
];

/** 앱가이드 다이얼로그 설명 마지막 문장 */
export const APP_GUIDE_SECURITY_DESC = DUAL_ENCRYPTION_COPY.appGuideDesc;

/** 기기 동기화 메뉴 설명 마지막 문장 */
export const SYNC_MENU_SECURITY_DESC = DUAL_ENCRYPTION_COPY.syncMenuDesc;

/** 스크린샷 업로드 박스 고지(주식·코인·현금·대출 4곳 공용) */
export const SCREENSHOT_UPLOAD_NOTICE = "스크린샷은 AI 인식을 위해 전송돼요. 인식된 자산 값은 이 기기에 저장돼요.";
