"use client";

import { createContext, useContext, type Dispatch } from "react";
import type { DemoSnapshot } from "@/features/demo/snapshot";
import type { DemoAction, DemoState } from "@/features/demo/state";
import type { EquipmentFilters } from "@/features/demo/selectors";

import type { DemoView } from "@/features/demo/views";

export type { DemoView };

export interface DemoContextValue {
  snapshot: DemoSnapshot;
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
  /** Polite screen-reader announcement. */
  announce: (message: string) => void;
  navigate: (view: DemoView, options?: { filters?: Partial<EquipmentFilters>; requestId?: string }) => void;
  openEquipment: (equipmentId: string) => void;
  openNewRequest: (equipmentId?: string) => void;
}

export const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo(): DemoContextValue {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used inside DemoWorkspace");
  return value;
}
