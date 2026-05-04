"use client";

import { createContext, useContext, useRef, ReactNode } from "react";
import { useStore } from "zustand";
import { tutorialStore, TutorialState } from "./tutorial-store";

type TutorialStoreApi = ReturnType<typeof tutorialStore.getState>;

const TutorialStoreContext = createContext<typeof tutorialStore | null>(null);

export function TutorialStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef(tutorialStore);
  return (
    <TutorialStoreContext.Provider value={storeRef.current}>
      {children}
    </TutorialStoreContext.Provider>
  );
}

export function useTutorialStore<T>(selector: (state: TutorialState) => T): T {
  const store = useContext(TutorialStoreContext);
  if (!store) throw new Error("useTutorialStore must be used within TutorialStoreProvider");
  return useStore(store, selector);
}
