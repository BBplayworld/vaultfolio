import { create } from "zustand";
import {
  getProfitBasis,
  setProfitBasis as persistProfitBasis,
  DEFAULT_PROFIT_BASIS,
  type ProfitBasis,
} from "@/lib/profit-utils";

interface ProfitBasisState {
  basis: ProfitBasis;
  hydrated: boolean;
  // 클라이언트 마운트 후 localStorage 값으로 동기화 (SSR hydration mismatch 방지)
  hydrate: () => void;
  setBasis: (b: ProfitBasis) => void;
}

export const useProfitBasisStore = create<ProfitBasisState>((set) => ({
  basis: DEFAULT_PROFIT_BASIS,
  hydrated: false,
  hydrate: () => set({ basis: getProfitBasis(), hydrated: true }),
  setBasis: (b) => {
    persistProfitBasis(b);
    set({ basis: b });
  },
}));
