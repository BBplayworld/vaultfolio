// /ratio 전용 문구 모음. 웰컴·앱 내 문구와 사실이 달라(인계 없음, 저장 전) 별도 상수로 둔다.

export const RATIO_TITLE = "캡처 한 장으로 내 종목 비중을 확인해요";
export const RATIO_DESC = "증권앱의 보유 종목 화면을 올리면 종목별 비중과 국내/해외 비율을 바로 보여드려요.";

export const RATIO_ERROR = {
  empty: "인식된 종목이 없어요. 보유 종목 목록 화면을 캡처해 주세요.",
  emptyPrice: "종목 가격을 읽지 못했어요. 평가금액이 보이는 화면을 캡처해 주세요.",
  limit: "오늘 미리보기 이용이 많아 마감됐어요. 내일 다시 시도해 주세요.",
  network: "네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
  fail: "인식에 실패했어요. 다시 시도해 주세요.",
} as const;

export const deviceLimitMessage = (limit: number) => `오늘 AI 인식 한도(${limit}회)를 모두 썼어요. 내일 다시 시도해 주세요.`;

/** 인앱 브라우저 안내 (웰컴 문장과 같은 첫 문장 + 인계가 없어 재업로드가 필요하다는 사실) */
export const RATIO_INAPP_NOTICE = "주소가 복사됐어요. 브라우저에 붙여넣어 주세요.";
export const RATIO_INAPP_BOX = "저장은 브라우저에서 할 수 있어요. 브라우저에서 사진을 한 번 더 올려 주세요.";
export const RATIO_INAPP_LAST_STEP = "이동한 브라우저에서 주소로 접속한 뒤 사진을 한 번 더 올려 주세요.";

export const RATIO_NOTES = {
  zeroPrice: (n: number) => `가격을 읽지 못한 종목 ${n}개는 비중에서 뺐어요.`,
  fx: "환율은 추정값이에요.",
  saveCaption: "금액은 저장 후 확인 창에서 볼 수 있어요.",
} as const;
