"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Search, X } from "lucide-react";
import { formatPriceByMode, formatShortCurrency, formatArea, sqmToPyeong, pyeongToSqm } from "@/lib/number-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InlineSelector } from "../../../layout/ui/inline-selector";
import { InfoHint } from "../../../layout/ui/info-hint";
import { RealEstate, realEstateSchema } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { useDaumPostcode, extractJibun } from "@/hooks/use-daum-postcode";
import { MAIN_PALETTE } from "@/config/theme";
import { realEstateTypes, quickButtonPresets, realEstateTradeDataset } from "@/config/asset-options";
import { getAddressDetail } from "@/lib/real-estate-address";

const realEstateQuickButtons = [...quickButtonPresets.realEstate];

// 추정 신뢰도 등급 — API의 grade를 사용자 언어로. approx 이하는 muted 톤으로 "참고" 성격을 명시.
type MatchGrade = "exact" | "similar" | "approx" | "estimated";
export const GRADE_BADGE: Record<MatchGrade, { label: string; tone: string }> = {
  exact: { label: "정확", tone: "bg-primary/15 text-primary" },
  similar: { label: "유사", tone: "bg-primary/10 text-primary" },
  approx: { label: "근사", tone: "bg-muted text-muted-foreground" },
  estimated: { label: "추정", tone: "bg-muted text-muted-foreground" },
};

// 등급별 한 줄 뜻 — 근거 줄에 긴 문장을 늘어놓는 대신 배지 옆 info로 옮긴다
const GRADE_NOTE: Record<MatchGrade, string> = {
  exact: "같은 단지·면적·층의 실거래입니다.",
  similar: "같은 단지·면적의 최근 실거래입니다.",
  approx: "동일 물건이 아닌 유사 거래 기반 근사치입니다.",
  estimated: "법정동 ㎡당 단가 중앙값으로 계산한 추정치입니다.",
};

export function GradeBadge({ grade, className = "", detail, inModal = false }: {
  grade?: MatchGrade | null;
  className?: string;
  /** 매칭기준·표본수 등 부수 근거 (선택) */
  detail?: ReactNode;
  /** Dialog·Sheet 내부면 true */
  inModal?: boolean;
}) {
  if (!grade || !GRADE_BADGE[grade]) return null;
  const g = GRADE_BADGE[grade];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 ${className}`}>
      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${g.tone}`}>{g.label}</span>
      <InfoHint summary={GRADE_NOTE[grade]} inModal={inModal}>{detail}</InfoHint>
    </span>
  );
}

interface RealEstateFormProps {
  editData?: RealEstate;
  onClose: () => void;
}

function RealEstateForm({ editData, onClose }: RealEstateFormProps) {
  const { addRealEstate, updateRealEstate } = useAssetData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<RealEstate["type"]>(editData?.type || "apartment");
  const [lookingUp, setLookingUp] = useState(false);
  const [areaOptions, setAreaOptions] = useState<number[]>([]);
  // 주소검색으로 확보한 지번 — 폼에 영속하지 않고 이번 세션의 estimate 호출에만 쓴다
  // (regionCode 없는 레거시 주소는 기존처럼 카카오 resolve가 지번을 채워준다)
  const [resolvedJibun, setResolvedJibun] = useState<string | undefined>(undefined);
  // 전용면적 자동 입력 근거 캡션 — 추정임을 감추지 않기 위해 표시
  const [areaAutoNote, setAreaAutoNote] = useState<string | null>(null);
  // 주소 검색 — 별도 브라우저 팝업이 아니라 이 다이얼로그 안에 임베드해서 띄운다
  const [addressSearchOpen, setAddressSearchOpen] = useState(false);
  const postcodeBoxRef = useRef<HTMLDivElement>(null);
  const { embedPostcode } = useDaumPostcode();
  // 추정 근거 표시 전용(폼 스키마 비영속) — 어떤 거래를 근거로 추정했는지 확인용
  const [matchInfo, setMatchInfo] = useState<{ complexName?: string; legalDong?: string; area?: number; floor?: number; source?: string; grade?: MatchGrade; sampleCount?: number; unitPrice?: number } | null>(null);
  // 면적 입력 단위 — 저장은 항상 ㎡, 입력 표시만 평으로 환산. 왕복 변환 오차를 막기 위해
  // NumberInput 값은 로컬 상태(입력 단위 기준)로 들고 폼에는 ㎡로만 반영한다.
  const [areaUnit, setAreaUnit] = useState<"sqm" | "pyeong">(editData?.areaUnitPreference ?? "sqm");
  const [areaInput, setAreaInput] = useState<number>(() => {
    const sqm = editData?.exclusiveArea ?? 0;
    if (!sqm) return 0;
    return (editData?.areaUnitPreference ?? "sqm") === "pyeong" ? Math.round(sqmToPyeong(sqm) * 100) / 100 : sqm;
  });

  const getNamePlaceholder = () => {
    if (selectedType === "apartment") return "예: 래미안 퍼스티지 84㎡";
    if (selectedType === "house") return "예: 성북구 단독주택";
    if (selectedType === "land") return "예: 경기도 양평 전원부지";
    if (selectedType === "commercial") return "예: 강남역 근린상가 101호";
    return "예: 기타 부동산";
  };

  const getAddressPlaceholder = () => {
    if (selectedType === "apartment") return "예: 서울시 서초구 반포동 1234";
    if (selectedType === "house") return "예: 서울시 성북구 정릉동 56";
    if (selectedType === "land") return "예: 경기도 양평군 강상면 000번지";
    if (selectedType === "commercial") return "예: 서울시 강남구 역삼동 123-4";
    return "예: 주소 입력";
  };

  const getCurrentValueLabel = () => {
    if (selectedType === "apartment") return "시세 (실거래가)";
    if (selectedType === "land") return "공시지가 / 시세";
    if (selectedType === "commercial") return "시세";
    return "현재 시세";
  };

  const form = useForm<RealEstate>({
    resolver: zodResolver(realEstateSchema),
    // 구 동/호 2칸을 상세주소 한 칸으로 통합 — 기존 데이터는 읽기 시점에 합쳐 보여준다(저장분 유실 없음)
    defaultValues: editData ? {
      ...editData,
      addressDetail: getAddressDetail(editData),
    } : {
      id: "",
      type: "apartment",
      name: "",
      address: "",
      purchasePrice: 0,
      currentValue: 0,
      purchaseDate: new Date().toISOString().split("T")[0],
      tenantDeposit: 0,
      description: "",
    },
  });

  const datasetInfo = realEstateTradeDataset[selectedType];
  const estimate = form.watch("marketEstimate");
  const estimateDate = form.watch("marketEstimateDate");

  // 면적 입력 → 항상 ㎡로 폼에 반영
  const applyArea = (input: number, unit: "sqm" | "pyeong") => {
    setAreaInput(input);
    setAreaAutoNote(null); // 값이 바뀌면 자동입력 근거 캡션은 무효
    const sqm = unit === "pyeong" ? pyeongToSqm(input) : input;
    form.setValue("exclusiveArea", input > 0 ? Math.round(sqm * 100) / 100 : undefined);
    form.setValue("areaUnitPreference", unit);
  };

  const changeAreaUnit = (unit: "sqm" | "pyeong") => {
    if (unit === areaUnit) return;
    const sqm = form.getValues("exclusiveArea") ?? 0;
    setAreaUnit(unit);
    form.setValue("areaUnitPreference", unit);
    setAreaInput(sqm > 0 ? Math.round((unit === "pyeong" ? sqmToPyeong(sqm) : sqm) * 100) / 100 : 0);
  };

  // 주소에서 파생된 검색 키(시군구코드·법정동·단지명·지번) 일괄 무효화.
  // 이 값들은 "현재 주소"에 종속되므로 주소가 바뀌면 반드시 함께 버려야 한다.
  const invalidateAddressKeys = () => {
    form.setValue("regionCode", undefined);
    form.setValue("legalDong", undefined);
    form.setValue("complexName", undefined);
    setResolvedJibun(undefined);
  };

  // 주소 검색 — 다음 우편번호 서비스로 정확한 주소·법정동코드·건물명을 한 번에 확보.
  // 여기서 얻은 값이 있으면 실거래가 조회 때 카카오 재해석(op=resolve)을 생략한다.
  // 컨테이너가 렌더된 뒤에 임베드해야 하므로 open 상태를 켜고 effect에서 심는다.
  useEffect(() => {
    if (!addressSearchOpen) return;
    const box = postcodeBoxRef.current;
    if (!box) return;
    let cancelled = false;
    (async () => {
      const ok = await embedPostcode(box, (data) => {
        form.setValue("address", data.roadAddress || data.jibunAddress, { shouldValidate: true });
        form.setValue("regionCode", data.sigunguCode);          // = MOLIT LAWD_CD
        if (data.bname) form.setValue("legalDong", data.bname);
        // 단지명은 주소 검색이 준 건물명만 신뢰한다 — 자산 이름("우리집" 등 별칭)을 단지명으로
        // 대체하면 매칭 키가 오염돼 엉뚱한 단지가 잡힌다.
        if (data.buildingName) form.setValue("complexName", data.buildingName);
        setResolvedJibun(extractJibun(data.jibunAddress));
        // 공동주택으로 확인됐고 사용자가 아직 유형을 바꾸지 않았으면 아파트로 제안
        if (data.apartment === "Y" && !editData && selectedType === "apartment") {
          form.setValue("type", "apartment");
        }
        setAddressSearchOpen(false);
        toast.success("주소를 불러왔습니다.");
      });
      if (!ok && !cancelled) {
        setAddressSearchOpen(false);
        toast.error("주소 검색을 열지 못했습니다. 네트워크 확인 후 직접 입력해주세요.");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressSearchOpen]);

  // 실거래가 조회: 주소 해석 → 종류별 MOLIT 매칭. 평형 미상이면 면적 후보로 수동 선택 폴백.
  const lookupPrice = async (areaOverride?: number) => {
    if (!datasetInfo) return;
    const address = (form.getValues("address") || "").trim();
    if (!address) { toast.error("주소를 입력해주세요."); return; }
    setLookingUp(true);
    setMatchInfo(null);
    // 새 조회 시작 — 이전 조회의 매칭 근거가 이번 실패 시 stale하게 남지 않도록 초기화
    form.setValue("marketEstimateComplexName", undefined);
    form.setValue("marketEstimateLegalDong", undefined);
    form.setValue("marketEstimateFloor", undefined);
    form.setValue("marketEstimateArea", undefined);
    form.setValue("marketEstimateGrade", undefined);
    form.setValue("marketEstimateSampleCount", undefined);
    try {
      // 주소검색(다음 우편번호)으로 이미 법정동코드를 확보했으면 카카오 재해석 생략 —
      // 자유 입력 주소만 해석이 필요하므로 resolve는 레거시 폴백으로만 쓴다.
      let lawdCd = form.getValues("regionCode");
      let legalDong = form.getValues("legalDong");
      let jibun = resolvedJibun;
      if (!lawdCd) {
        const rres = await fetch(`/api/realestate?op=resolve&query=${encodeURIComponent(address)}`);
        const r = await rres.json();
        if (r.error || !r.lawdCd) { toast.error(r.error || "주소를 해석하지 못했습니다."); return; }
        lawdCd = r.lawdCd;
        legalDong = r.legalDong || legalDong;
        jibun = r.jibun || jibun;
        form.setValue("regionCode", r.lawdCd);
        if (r.legalDong) form.setValue("legalDong", r.legalDong);
        if (r.buildingName) form.setValue("complexName", r.buildingName);
      }
      if (!lawdCd) { toast.error("주소를 해석하지 못했습니다."); return; }
      // 단지명은 주소 검색·해석이 확보한 값 또는 사용자가 직접 입력한 값만 쓴다(자산 이름 대체 금지)
      const complexName = form.getValues("complexName") || "";

      const area = areaOverride ?? form.getValues("exclusiveArea");
      // 단독·상가는 단지명으로 좁힐 수 없어 면적 없이는 매칭이 무의미하다 (오매칭 방지)
      if (datasetInfo.matchBy === "area" && !area) {
        toast.message(`${datasetInfo.areaLabel}을 입력하면 추정 정확도가 크게 올라갑니다.`);
      }
      const params = new URLSearchParams({ op: "estimate", dataset: datasetInfo.dataset, lawd: lawdCd, matchBy: datasetInfo.matchBy, areaKind: datasetInfo.areaKind });
      if (complexName) params.set("complexName", complexName);
      if (legalDong) params.set("legalDong", legalDong);
      if (jibun) params.set("jibun", jibun);
      if (area) params.set("area", String(area));
      const eres = await fetch(`/api/realestate?${params.toString()}`);
      const e = await eres.json();
      if (e.estimate) {
        form.setValue("marketEstimate", e.estimate);
        if (e.date) form.setValue("marketEstimateDate", e.date);
        if (e.source) form.setValue("marketEstimateSource", e.source);
        // 매칭된 거래의 면적은 근거 표시용으로 별도 보관. 사용자가 직접 입력한 exclusiveArea는 덮어쓰지 않되,
        // 아직 비어 있으면 매칭 면적으로 채워 다음 조회의 정확도를 올린다.
        if (e.matchedArea) {
          form.setValue("marketEstimateArea", e.matchedArea);
          if (!form.getValues("exclusiveArea")) applyArea(areaUnit === "pyeong" ? Math.round(sqmToPyeong(e.matchedArea) * 100) / 100 : e.matchedArea, areaUnit);
        }
        // 실제 매칭된 거래 레코드 값 — 검색 키(complexName/legalDong)와 다를 수 있어 별도 저장(정확한 근거 표시용)
        form.setValue("marketEstimateComplexName", e.matchedComplexName || undefined);
        form.setValue("marketEstimateLegalDong", e.matchedLegalDong || undefined);
        form.setValue("marketEstimateFloor", e.matchedFloor ?? undefined);
        form.setValue("marketEstimateGrade", e.grade || undefined);
        form.setValue("marketEstimateSampleCount", e.sampleCount ?? undefined);
        setMatchInfo({
          complexName: e.matchedComplexName || undefined,
          legalDong: e.matchedLegalDong || undefined,
          area: e.matchedArea || undefined,
          floor: e.matchedFloor || undefined,
          source: e.source || undefined,
          grade: e.grade || undefined,
          sampleCount: e.sampleCount ?? undefined,
          unitPrice: e.unitPrice ?? undefined,
        });
        setAreaOptions([]);
        toast.success("최근 실거래가를 불러왔습니다.");
      } else if (Array.isArray(e.areas) && e.areas.length > 0) {
        setAreaOptions(e.areas);
        // 단일 평형 단지면 사용자 입력 없이 확정 가능 — 자동 입력 후 바로 재조회.
        // 사용자가 이미 면적을 넣었으면 절대 덮어쓰지 않는다.
        if (e.areas.length === 1 && !form.getValues("exclusiveArea") && !areaOverride) {
          const only = e.areas[0] as number;
          applyArea(areaUnit === "pyeong" ? Math.round(sqmToPyeong(only) * 100) / 100 : only, areaUnit);
          setAreaAutoNote(`이 단지 실거래 기준 ${formatArea(only)} 자동 입력`);
          void lookupPrice(only);
          return;
        }
        toast.message("평형(전용면적)을 선택하면 추정치를 계산합니다.");
      } else {
        toast.error(e.error || "매칭되는 실거래를 찾지 못했습니다.");
      }
    } catch {
      toast.error("조회 중 오류가 발생했습니다.");
    } finally {
      setLookingUp(false);
    }
  };

  const onSubmit = async (data: RealEstate) => {
    setIsSubmitting(true);
    try {
      if (editData) {
        const success = updateRealEstate(editData.id, data);
        if (success) {
          toast.success("부동산 정보가 수정되었습니다.");
          onClose();
        } else {
          toast.error("저장에 실패했습니다.");
        }
      } else {
        const newData = {
          ...data,
          id: `re_${Date.now()}`,
        };
        const success = addRealEstate(newData);
        if (success) {
          toast.success("부동산이 추가되었습니다.");
          onClose();
        } else {
          toast.error("저장에 실패했습니다.");
        }
      }
    } catch (error) {
      toast.error("오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>유형</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  setSelectedType(value as RealEstate["type"]);
                }}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="부동산 유형 선택" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {realEstateTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>이름 *</FormLabel>
              <FormControl>
                <Input placeholder={getNamePlaceholder()} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>주소</FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <Input
                    placeholder={getAddressPlaceholder()}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      // 주소를 직접 고치면 이전 주소에서 얻은 검색 키를 무효화한다.
                      // 남겨두면 lookupPrice가 resolve를 건너뛰고 옛 시군구코드로 조회한다(다른 지역 시세 오매칭).
                      invalidateAddressKeys();
                    }}
                  />
                </FormControl>
                {/* 검색으로 채우는 게 정확하지만, 해외·미등기 등은 직접 입력이 필요해 Input은 편집 가능하게 둔다 */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddressSearchOpen((v) => !v)}
                  className="shrink-0 gap-1.5"
                >
                  <Search className="size-3.5" />
                  주소 검색
                </Button>
              </div>
              {/* 앱 다이얼로그 안에서 바로 검색 — 별도 브라우저 팝업 없음 */}
              {addressSearchOpen && (
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-muted/40">
                    <span className="text-xs font-medium text-muted-foreground">주소를 검색해 선택하세요</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      title="주소 검색 닫기"
                      onClick={() => setAddressSearchOpen(false)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                  <div ref={postcodeBoxRef} className="h-[420px] w-full" />
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="addressDetail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>상세주소 (동·호)</FormLabel>
              <FormControl>
                <Input placeholder="예: 101동 1203호" value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
              <FormDescription>주소 검색은 건물까지만 찾아줍니다. 동·호는 여기에 입력하세요.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 실거래가 조회 (S-4.21) — 데이터셋 있는 종류만. currentValue와 병기(참고용) */}
        {datasetInfo && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">실거래가 조회 <span className="text-xs font-normal text-muted-foreground">참고용</span></p>
              <Button type="button" size="sm" variant="outline" onClick={() => lookupPrice()} disabled={lookingUp} className="h-8">
                {lookingUp ? <Loader2 className="size-3 animate-spin" /> : "실거래가 조회"}
              </Button>
            </div>
            {/* 면적 직접 입력 — 단독·상가는 이 값이 없으면 매칭 자체가 불가하다 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {datasetInfo.areaLabel}
                  {datasetInfo.matchBy === "area" && <span className="ml-1 text-xs font-normal text-muted-foreground">정확도 핵심</span>}
                </p>
                <InlineSelector
                  size="sm"
                  value={areaUnit}
                  onChange={changeAreaUnit}
                  options={[{ value: "sqm", label: "㎡" }, { value: "pyeong", label: "평" }]}
                  ariaLabel="면적 단위 선택"
                />
              </div>
              <NumberInput
                value={areaInput}
                onChange={(v) => applyArea(v, areaUnit)}
                allowDecimals
                maxDecimals={2}
                placeholder={areaUnit === "pyeong" ? "예: 25.7" : "예: 84.95"}
                className="h-9"
              />
              {areaAutoNote && <p className="text-xs text-muted-foreground">{areaAutoNote}</p>}
            </div>
            {areaOptions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">실거래에 잡힌 면적에서 고를 수도 있어요</p>
                <Select onValueChange={(v) => { applyArea(areaUnit === "pyeong" ? Math.round(sqmToPyeong(parseFloat(v)) * 100) / 100 : parseFloat(v), areaUnit); lookupPrice(parseFloat(v)); }}>
                  <SelectTrigger className="h-8"><SelectValue placeholder={`${datasetInfo.areaLabel} 선택`} /></SelectTrigger>
                  <SelectContent>
                    {areaOptions.map((a) => (
                      <SelectItem key={a} value={String(a)}>{a}㎡ (약 {sqmToPyeong(a).toFixed(0)}평)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {estimate ? (
              <div className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    최근 실거래 추정{estimateDate ? ` (${estimateDate})` : ""}
                    <GradeBadge
                      grade={matchInfo?.grade}
                      inModal
                      detail={matchInfo && (
                        <>
                          {matchInfo.source && <p>매칭기준 {matchInfo.source}</p>}
                          {matchInfo.sampleCount ? <p>유사 거래 {matchInfo.sampleCount}건</p> : null}
                          {matchInfo.unitPrice ? <p>㎡당 {formatShortCurrency(matchInfo.unitPrice)}</p> : null}
                        </>
                      )}
                    />
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-bold tabular-nums text-foreground">{formatPriceByMode(estimate)}</span>
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => form.setValue("currentValue", estimate)}>시세에 반영</Button>
                  </span>
                </div>
                {matchInfo && (
                  <p className="text-xs text-muted-foreground text-pretty">
                    근거: {[
                      matchInfo.complexName,
                      matchInfo.legalDong,
                      matchInfo.area ? formatArea(matchInfo.area) : undefined,
                      matchInfo.floor !== undefined ? `${matchInfo.floor}층` : undefined,
                    ].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            ) : (
              <p className="flex items-center gap-1 text-xs text-muted-foreground text-pretty">
                {datasetInfo.matchBy === "area"
                  ? `${datasetInfo.areaLabel}을 입력하면 조회할 수 있습니다.`
                  : "주소를 입력하고 조회하면 추정치를 병기합니다."}
                {datasetInfo.matchBy === "area" && (
                  <InfoHint summary="단독·상가·사무실은 단지명이 없어 법정동+면적 기준 근사치로만 추정합니다." inModal />
                )}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="purchasePrice"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel style={{ color: "var(--accent-teal)" }}>매입가 *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                    maxLength={15}
                    quickButtons={realEstateQuickButtons}
                  />
                </FormControl>
                <FormDescription>원 (취득 당시 실거래가)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currentValue"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel style={{ color: "var(--accent-teal)" }}>{getCurrentValueLabel()} *</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                    maxLength={15}
                    quickButtons={realEstateQuickButtons}
                  />
                </FormControl>
                <FormDescription>원 (현재 기준)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="purchaseDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>매입일 *</FormLabel>
              <FormControl>
                <Input type="date" className="w-full text-sm" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tenantDeposit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>임차인 보증금</FormLabel>
              <FormControl>
                <NumberInput
                  value={field.value || 0}
                  onChange={field.onChange}
                  placeholder="0"
                  maxLength={15}
                  quickButtons={realEstateQuickButtons}
                />
              </FormControl>
              <FormDescription>임대를 주는 경우 임차인 보증금 (순자산 계산 시 차감)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>설명</FormLabel>
              <FormControl>
                <Textarea placeholder="추가 정보 입력..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="submit"
            variant="brand"
            disabled={isSubmitting}>
            {isSubmitting ? "저장 중..." : editData ? "수정" : "추가"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export function RealEstateInput() {
  const { assetData } = useAssetData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RealEstate | undefined>();

  useEffect(() => {
    const handler = () => { setEditingItem(undefined); setIsDialogOpen(true); };
    window.addEventListener("trigger-add-real-estate", handler);
    return () => window.removeEventListener("trigger-add-real-estate", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      const item = assetData.realEstate.find((r) => r.id === id);
      if (item) { setEditingItem(item); setIsDialogOpen(true); }
    };
    window.addEventListener("trigger-edit-real-estate", handler);
    return () => window.removeEventListener("trigger-edit-real-estate", handler);
  }, [assetData.realEstate]);

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingItem(undefined);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0">
        <DialogHeader>
          <DialogTitle>{editingItem ? "부동산 수정" : "부동산 추가"}</DialogTitle>
          <DialogDescription>
            {editingItem ? "부동산 정보를 수정합니다." : "새로운 부동산 자산을 추가합니다."}
          </DialogDescription>
        </DialogHeader>
        <RealEstateForm editData={editingItem} onClose={handleDialogClose} />
      </DialogContent>
    </Dialog>
  );
}
