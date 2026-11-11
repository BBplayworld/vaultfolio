import { Activity, List, IdCard, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ActiveTutorialStep } from "@/stores/tutorial/tutorial-store";

export interface TutorialStepConfig {
  step: ActiveTutorialStep;
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

export const TUTORIAL_STEP_CONFIGS: Record<ActiveTutorialStep, TutorialStepConfig> = {
  1: {
    step: 1,
    targetAttr: "tutorial-fab",
    title: "자산을 업데이트해보세요",
    description: "아래 버튼을 눌러 주식, 부동산, 현금 등 자산을 추가하거나 수정할 수 있습니다.",
    icon: Activity,
    preferPosition: "top",
  },
  3: {
    step: 3,
    targetAttr: "tutorial-screenshot-btn",
    title: "인증카드로 공유해보세요",
    description: "인증카드 버튼을 눌러 자산 현황을 이미지로 저장하거나 공유할 수 있습니다.",
    icon: IdCard,
    preferPosition: "bottom",
  },
  4: {
    step: 4,
    targetAttr: "tutorial-detail-tab",
    title: "상세 탭에서 자산을 확인하세요",
    description: "상세 탭을 눌러 자산별 목록과 현재가, 거래 내역을 확인할 수 있습니다.",
    icon: List,
    preferPosition: "bottom",
  },

  5: {
    step: 5,
    targetAttr: "tutorial-activity-tab",
    title: "성과 탭을 확인하세요",
    description: "성과 탭에서 순자산·수익·배당을 한눈에 확인할 수 있습니다.",
    icon: TrendingUp,
    preferPosition: "bottom",
  },
};
