// 시크릿에셋 핵심 기능 카탈로그 — 홈 "기능 활용 팁" 추천 박스(feature-tip-box.tsx)의 단일 출처.
// 신규 기능(isNew)을 최우선 추천하고, 이후엔 방문 기록(feature-usage.ts) 기반 저방문 기능을 추천한다.
// 신규 공용 기능을 추가하면 이 파일에도 등록한다(누락 시 팁 추천 대상에서 빠진다).

import type { LucideIcon } from "lucide-react";
import { Calculator, Calendar, TrendingUp, ScanSearch, Building2, Coins, Wallet, Landmark, LineChart, PiggyBank, Gift, FileBarChart, IdCard } from "lucide-react";
import type { AssetView } from "@/app/(main)/_components/layout/navigation/navigation-context";
import { useTaxViewStore } from "@/stores/tax-view-store";
import { dispatchOpenShareCard } from "@/app/(main)/_components/layout/navigation/asset-dispatch";

export interface AppFeature {
  id: string; // 방문 무관, 팁 개별 dismiss 키
  title: string;
  description: string; // 한 줄 팁 문구
  icon: LucideIcon;
  isNew?: boolean; // 이번 릴리스 신규 기능 — 최우선 추천
  // 이동 방식 — target(대부분) 또는 action(이동 없이 그 자리에서 실행) 중 하나만 채운다
  target?: AssetView;
  beforeNavigate?: () => void; // target 이동 직전 실행(세금 관리 내부 로컬 서브탭 지정 등)
  action?: () => void; // target 없이 즉시 실행하는 커스텀 동작(인증카드 다이얼로그 오픈 등)
  visitKey?: string; // action형처럼 target이 없어 방문 집계 키를 별도 지정해야 하는 경우
}

export const APP_FEATURES: AppFeature[] = [
  {
    id: "tax-simulator",
    title: "연말 절세 시뮬레이션",
    description: "해외주식을 지금 팔면 세금이 얼마인지, 손실 종목을 더하면 얼마나 아끼는지 세금 관리에서 바로 확인해보세요.",
    icon: Calculator,
    target: { type: "tax" },
    beforeNavigate: () => useTaxViewStore.getState().setInitialTab("simulator"),
  },
  {
    id: "tax-schedule",
    title: "세금 일정 관리",
    description: "보유 자산 기준으로 챙겨야 할 신고·납부 일정을 세금 관리에서 월별로 확인하세요.",
    icon: Calendar,
    target: { type: "tax" },
  },
  {
    id: "stocks",
    title: "주식",
    description: "상세 탭의 주식에서 보유 종목별 평가금액과 손익을 확인하세요.",
    icon: TrendingUp,
    target: { type: "detail", tab: "stocks" },
  },
  {
    id: "stocks-xray",
    title: "주식 X-Ray 분석",
    description: "상세 탭의 주식 X-Ray에서 성장주·배당주·지수투자 등 종목 유형부터 섹터·국가별 비중까지 분석해보세요.",
    icon: ScanSearch,
    isNew: true,
    target: { type: "detail", tab: "stocks-xray" },
  },
  {
    id: "real-estate",
    title: "부동산",
    description: "상세 탭의 부동산에서 보유 물건의 시세와 대출 현황을 확인하세요.",
    icon: Building2,
    target: { type: "detail", tab: "real-estate" },
  },
  {
    id: "crypto",
    title: "암호화폐",
    description: "상세 탭의 암호화폐에서 보유 코인 시세를 자동 갱신으로 확인하세요.",
    icon: Coins,
    target: { type: "detail", tab: "crypto" },
  },
  {
    id: "cash",
    title: "현금",
    description: "상세 탭의 현금에서 계좌별 잔액과 입출금 내역을 관리하세요.",
    icon: Wallet,
    target: { type: "detail", tab: "cash" },
  },
  {
    id: "loans",
    title: "대출",
    description: "상세 탭의 대출에서 대출 잔액과 상환 내역을 관리하세요.",
    icon: Landmark,
    target: { type: "detail", tab: "loans" },
  },
  {
    id: "netasset",
    title: "순자산 변화",
    description: "성과 탭의 순자산 변화에서 자산 추이를 그래프로 확인하세요.",
    icon: LineChart,
    target: { type: "activity", tab: "netasset" },
  },
  {
    id: "profit",
    title: "수익",
    description: "성과 탭의 수익에서 기간별 투자 수익률을 확인하세요.",
    icon: PiggyBank,
    target: { type: "activity", tab: "profit" },
  },
  {
    id: "dividend",
    title: "배당",
    description: "성과 탭의 배당에서 받은 배당금 내역을 확인하세요.",
    icon: Gift,
    target: { type: "activity", tab: "dividend" },
  },
  {
    id: "report",
    title: "자산 성적표",
    description: "성과 탭의 자산 성적표에서 내 자산을 한눈에 요약해서 확인하세요.",
    icon: FileBarChart,
    target: { type: "activity", tab: "report" },
  },
  {
    id: "share-card",
    title: "인증카드",
    description: "상단의 인증카드 버튼으로 주식 현황과 포트폴리오 구성 비중(종목별 원형 차트)을 이미지로 저장·공유해보세요.",
    icon: IdCard,
    action: dispatchOpenShareCard,
    visitKey: "share-card",
  },
  {
    id: "share-card-portfolio",
    title: "포트폴리오 인증카드",
    description: "인증카드 > 포트폴리오에서 종목 로고가 담긴 원형 차트에 분야·보유 유형 구성까지 한 장에 담아 공유해보세요.",
    icon: IdCard,
    isNew: true,
    action: () => dispatchOpenShareCard("portfolio"),
    visitKey: "share-card-portfolio",
  },
  {
    id: "share-card-type",
    title: "투자 유형 인증카드",
    description: "인증카드 > 투자 유형에서 내 포트폴리오를 분석한 투자 유형과 캐릭터 아바타를 확인하고 공유해보세요.",
    icon: IdCard,
    isNew: true,
    action: () => dispatchOpenShareCard("type"),
    visitKey: "share-card-type",
  },
];
