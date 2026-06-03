import { Database, Sparkles, Activity, List, Camera, Settings, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TutorialStep } from "@/stores/tutorial/tutorial-store";

export interface TutorialStepConfig {
  step: TutorialStep;
  /** data-tutorial 셀렉터. null이면 하이라이트 없이 중앙 카드 형태 */
  targetAttr: string | null;
  title: string;
  description: string;
  icon: LucideIcon;
  /** 말풍선 선호 위치: "top" | "bottom" | "auto" */
  preferPosition: "top" | "bottom" | "auto";
  /** Sub-step이 있는 경우 두 번째 단계의 제목과 설명을 지정 */
  title2?: string;
  description2?: string;
}

export const TUTORIAL_STEP_CONFIGS: Record<TutorialStep, TutorialStepConfig> = {
  0: {
    step: 0,
    targetAttr: null,
    title: "Secret Asset에 오신 것을 환영합니다!",
    description: "",
    icon: Sparkles,
    preferPosition: "auto",
  },
  1: {
    step: 1,
    targetAttr: "tutorial-fab",
    title: "자산을 업데이트해보세요",
    description: "아래 버튼을 눌러 주식, 부동산, 현금 등 자산을 추가하거나 수정할 수 있습니다.",
    icon: Activity,
    preferPosition: "top",
  },
  2: {
    step: 2,
    targetAttr: "tutorial-detail-tab",
    title: "상세 탭에서 자산을 확인하세요",
    description: "상세 탭을 클릭하면 자산별 목록과 현재가를 볼 수 있습니다.",
    icon: List,
    preferPosition: "bottom",
  },
  3: {
    step: 3,
    targetAttr: "tutorial-screenshot-btn",
    title: "인증샷으로 공유해보세요",
    description: "인증샷 버튼을 눌러 자산 현황을 이미지로 저장하거나 공유할 수 있습니다.",
    icon: Camera,
    preferPosition: "bottom",
  },
  4: {
    step: 4,
    targetAttr: "tutorial-tool-menu",
    title: "자산 도구를 활용해보세요",
    description: "데이터 내보내기, 가져오기, 공유 URL 생성, AI 분석 프롬프트 등을 지원합니다.",
    icon: Settings,
    preferPosition: "bottom",
  },

  5: {
    step: 5,
    targetAttr: "tutorial-activity-tab",
    title: "성과 탭에서 성과를 확인하세요",
    description: "성과 탭을 클릭하여 자산 추이와 수익률을 한눈에 확인하세요.",
    title2: "수익 탭에서 수익을 확인하세요",
    description2: "수익 탭을 클릭하여 자산별 누적 수익률과 수익금을 한눈에 확인하세요.",
    icon: TrendingUp,
    preferPosition: "bottom",
  },
};

/** Step 0에서 보여줄 AppGuide 콘텐츠 아이템 */
export const APP_GUIDE_ITEMS = [
  {
    icon: Database,
    title: "영지식(Zero-Knowledge) 이중 보안",
    description:
      "데이터는 이 기기 브라우저에만 보관됩니다. '공유 URL 복사' 시에도 랜덤 키(Key)와 사용자 PIN이 완전히 분리되어, 관리자를 포함한 그 누구도 서버 데이터 단독으로는 복호화할 수 없습니다.",
  },
  {
    icon: Sparkles,
    title: "AI 자산 분석",
    description:
      "상단 자산 도구 메뉴에서 Grok·Gemini·GPT에 바로 붙여넣을 수 있는 AI 평가용 프롬프트를 생성할 수 있습니다. 데이터 내보내기·가져오기도 지원합니다.",
  },
  {
    icon: Activity,
    title: "매일 자동 업데이트",
    description:
      "보유 주식 현재가와 환율(USD·JPY)을 매일 최신 정보로 자동 반영합니다.",
  },
];
