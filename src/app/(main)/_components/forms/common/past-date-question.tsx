"use client";

// 과거 날짜 질문(5.158 #311, ui.md 1절) — 현금 입출금·주식 거래 폼 공용. 반영 체크박스 상자 바로 위.
// 상태는 폼의 reflected 하나. answered는 화면 전용(미응답이면 두 칸 모두 선택 표시 없음 = InlineSelector value null).
import { InlineSelector } from "../../layout/ui/inline-selector";

const QUESTION = {
  cash: "이 돈이 지금 잔액에 이미 들어 있나요?",
  stock: "이 거래가 지금 보유 수량에 이미 들어 있나요?",
} as const;

// 칸 라벨은 InlineSelector 칸의 truncate 대신 break-keep 줄바꿈을 허용(320 폭, ui.md 1절 '줄 수')
const label = (text: string) => <span className="block whitespace-normal break-keep leading-tight">{text}</span>;

export function PastDateQuestion({ kind, answered, reflected, onAnswer }: {
  kind: "cash" | "stock";
  answered: boolean;
  reflected: boolean;
  onAnswer: (reflected: boolean) => void; // true = 아니요, 더해 주세요(체크 유지) / false = 이미 들어 있어요(기록만)
}) {
  return (
    <div data-testid="past-date-question" className="space-y-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-150">
      <p className="text-sm font-medium break-keep text-pretty">{QUESTION[kind]}</p>
      <InlineSelector
        value={answered ? (reflected ? "add" : "in") : null}
        onChange={(v) => onAnswer(v === "add")}
        options={[
          { value: "in", label: label("이미 들어 있어요"), testId: "past-date-answer-in" },
          { value: "add", label: label("아니요, 더해 주세요"), testId: "past-date-answer-add" },
        ]}
        fullWidth
        tight
        ariaLabel={QUESTION[kind]} // radiogroup 이름 = 질문 문장(스크린리더)
      />
    </div>
  );
}
