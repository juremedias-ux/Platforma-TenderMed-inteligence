"use client";

import { Boxes, Gavel, LayoutDashboard, Lightbulb, RotateCcw, Wrench, type LucideIcon } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { computeOverview, emptyEquipmentFilters, type EquipmentFilters } from "@/features/demo/selectors";
import type { DemoSnapshot } from "@/features/demo/snapshot";
import { createInitialDemoState, demoReducer } from "@/features/demo/state";
import { formatLongDate } from "@/lib/dates/format";
import { cn } from "@/lib/utils/cn";
import { demoViews, type DemoView } from "@/features/demo/views";
import { DemoContext, type DemoContextValue } from "./demo-context";
import { EquipmentDrawer } from "./equipment-drawer";
import { EquipmentView } from "./equipment-view";
import { NewServiceRequestDialog } from "./new-service-request-dialog";
import { OverviewView } from "./overview-view";
import { RecommendationsView } from "./recommendations-view";
import { ServiceView } from "./service-view";
import { TendersView } from "./tenders-view";

const viewMeta: Record<DemoView, { label: string; icon: LucideIcon; title: string; description: string }> = {
  pregled: {
    label: "Pregled",
    icon: LayoutDashboard,
    title: "Pregled",
    description: "Stanje opreme, servisnih aktivnosti in odprtih zahtevkov na enem mestu.",
  },
  oprema: {
    label: "Oprema",
    icon: Boxes,
    title: "Evidenca opreme",
    description: "Iščite in filtrirajte naprave ter odprite podrobnosti posamezne naprave.",
  },
  servisi: {
    label: "Servisi",
    icon: Wrench,
    title: "Servisi in usklajevanje",
    description: "Odprite zahtevek, predlagajte in potrdite termin ter ločeno zabeležite izvedbo.",
  },
  priporocila: {
    label: "Priporočila",
    icon: Lightbulb,
    title: "Priporočene rešitve",
    description: "Predlogi za nadaljnji pregled z razlago, dokazi, manjkajočimi podatki in razkritjem.",
  },
  razpisi: {
    label: "Razpisi",
    icon: Gavel,
    title: "Razpisna inteligenca",
    description: "Ponazoritveni razpisi in primerjava zahtev s profilom izmišljenega dobavitelja.",
  },
};

export function DemoWorkspace({ snapshot, initialView }: { snapshot: DemoSnapshot; initialView: DemoView }) {
  const initialState = useMemo(() => createInitialDemoState(snapshot.dataset, snapshot.recommendations), [snapshot]);
  const [state, dispatch] = useReducer(demoReducer, initialState);
  const [view, setView] = useState<DemoView>(initialView);
  const [filters, setFilters] = useState<EquipmentFilters>(emptyEquipmentFilters);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [drawerEquipmentId, setDrawerEquipmentId] = useState<string | null>(null);
  const [newRequest, setNewRequest] = useState<{ open: boolean; equipmentId?: string }>({ open: false });
  const [announcement, setAnnouncement] = useState("");
  const tabRefs = useRef<Partial<Record<DemoView, HTMLButtonElement | null>>>({});

  // Close transient overlays if the route is hidden by client navigation.
  useLayoutEffect(
    () => () => {
      setDrawerEquipmentId(null);
      setNewRequest({ open: false });
    },
    [],
  );

  const announce = useCallback((message: string) => {
    setAnnouncement("");
    window.setTimeout(() => setAnnouncement(message), 30);
  }, []);

  const selectView = useCallback((next: DemoView) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "pregled") url.searchParams.delete("pogled");
    else url.searchParams.set("pogled", next);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const navigate = useCallback<DemoContextValue["navigate"]>(
    (next, options) => {
      if (options?.filters) setFilters({ ...emptyEquipmentFilters, ...options.filters });
      if (options?.requestId) setSelectedRequestId(options.requestId);
      setDrawerEquipmentId(null);
      selectView(next);
      document.getElementById("demo-vsebina")?.focus({ preventScroll: false });
    },
    [selectView],
  );

  const contextValue = useMemo<DemoContextValue>(
    () => ({
      snapshot,
      state,
      dispatch,
      announce,
      navigate,
      openEquipment: (id) => setDrawerEquipmentId(id),
      openNewRequest: (equipmentId) => setNewRequest({ open: true, equipmentId }),
    }),
    [snapshot, state, announce, navigate],
  );

  const overview = computeOverview(snapshot.dataset, state);
  const tabBadges: Partial<Record<DemoView, number>> = {
    servisi: overview.openServiceRequests,
    priporocila: overview.recommendationsAwaitingReview,
  };

  function resetDemo() {
    dispatch({ type: "reset", initialState });
    setFilters(emptyEquipmentFilters);
    setSelectedRequestId(null);
    setDrawerEquipmentId(null);
    announce("Demo je ponastavljen na začetno stanje.");
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: DemoView) {
    const index = demoViews.indexOf(current);
    let next: DemoView | undefined;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = demoViews[(index + 1) % demoViews.length];
    if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      next = demoViews[(index - 1 + demoViews.length) % demoViews.length];
    if (event.key === "Home") next = demoViews[0];
    if (event.key === "End") next = demoViews[demoViews.length - 1];
    if (next) {
      event.preventDefault();
      selectView(next);
      tabRefs.current[next]?.focus();
    }
  }

  const meta = viewMeta[view];

  return (
    <DemoContext.Provider value={contextValue}>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col lg:flex-row">
        <aside className="border-b border-line bg-surface lg:sticky lg:top-[5.75rem] lg:h-[calc(100dvh-5.75rem)] lg:overflow-y-auto lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
          <div className="hidden px-5 pt-6 pb-3 lg:block">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted uppercase">Izmišljena ustanova</p>
            <p className="mt-1 text-sm font-semibold text-ink">{snapshot.dataset.organization.name}</p>
          </div>
          <div
            role="tablist"
            aria-label="Pogledi demonstracije"
            aria-orientation="vertical"
            className="relative flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:overflow-visible lg:px-3 lg:py-2"
          >
            {demoViews.map((id) => {
              const item = viewMeta[id];
              const selected = view === id;
              const badge = tabBadges[id];
              return (
                <button
                  key={id}
                  ref={(el) => {
                    tabRefs.current[id] = el;
                  }}
                  role="tab"
                  type="button"
                  id={`demo-zavihek-${id}`}
                  aria-selected={selected}
                  aria-controls="demo-vsebina"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectView(id)}
                  onKeyDown={(event) => onTabKeyDown(event, id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                    selected ? "bg-navy-900 text-white" : "text-ink-soft hover:bg-subtle hover:text-ink",
                  )}
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  <span className="lg:flex-1 lg:text-left">{item.label}</span>
                  {badge !== undefined ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular-nums",
                        selected ? "bg-white/15 text-white" : "bg-subtle text-ink-soft",
                      )}
                    >
                      {badge}
                      <span className="sr-only">{id === "servisi" ? " odprtih zahtevkov" : " za pregled"}</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="hidden border-t border-line px-5 py-4 text-xs leading-relaxed text-ink-muted lg:block">
            Referenčni datum demonstracije:
            <br />
            <time dateTime={state.referenceDate} className="font-medium text-ink-soft">
              {formatLongDate(state.referenceDate)}
            </time>
          </div>
        </aside>

        <div
          id="demo-vsebina"
          role="tabpanel"
          aria-labelledby={`demo-zavihek-${view}`}
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8"
        >
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-ink">{meta.title}</h2>
              <p className="mt-1 max-w-2xl text-sm text-ink-soft">{meta.description}</p>
            </div>
            <Button variant="secondary" size="md" onClick={resetDemo} className="self-start">
              <RotateCcw aria-hidden="true" />
              Ponastavi demo
            </Button>
          </div>

          {view === "pregled" ? <OverviewView /> : null}
          {view === "oprema" ? <EquipmentView filters={filters} onFiltersChange={setFilters} /> : null}
          {view === "servisi" ? (
            <ServiceView selectedRequestId={selectedRequestId} onSelectRequest={setSelectedRequestId} />
          ) : null}
          {view === "priporocila" ? <RecommendationsView /> : null}
          {view === "razpisi" ? <TendersView /> : null}
        </div>
      </div>

      <EquipmentDrawer equipmentId={drawerEquipmentId} onClose={() => setDrawerEquipmentId(null)} />
      <NewServiceRequestDialog
        open={newRequest.open}
        initialEquipmentId={newRequest.equipmentId}
        onOpenChange={(open) => setNewRequest((current) => ({ ...current, open }))}
        onCreated={(requestId) => {
          setSelectedRequestId(requestId);
          selectView("servisi");
        }}
      />

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </DemoContext.Provider>
  );
}
