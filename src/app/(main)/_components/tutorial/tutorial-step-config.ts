import { Activity, List, Camera, Settings, TrendingUp } from "lucide-react";
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
    targetAttr: "tutorial-tool-menu",
    title: "더보기를 활용해보세요",
    description: "데이터 내보내기·가져오기, 공유 URL 생성, AI 분석 프롬프트 등을 지원합니다.",
    icon: Settings,
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
