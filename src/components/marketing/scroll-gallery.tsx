"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Horizontal gallery with scroll snapping and previous / next buttons.
 * Works with touch, trackpad and keyboard (the track is focusable and
 * scrolls with arrow keys); the buttons scroll by one card.
 */
export function ScrollGallery({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    update();
    const el = track.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const scrollByCard = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const step = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * step, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className={className}>
      <ul
        ref={track}
        role="list"
        aria-label={label}
        tabIndex={0}
        className="snap-gallery -mx-4 flex scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 focus-visible:outline-offset-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-ml-8 lg:mr-[calc(50%-50vw)] lg:scroll-px-8 lg:px-8"
      >
        {children}
      </ul>
      <div className="mt-6 flex justify-end gap-3">
        {(
          [
            [-1, "Prejšnji korak", ChevronLeft, edges.start],
            [1, "Naslednji korak", ChevronRight, edges.end],
          ] as const
        ).map(([direction, name, Icon, disabled]) => (
          <button
            key={direction}
            type="button"
            aria-label={name}
            disabled={disabled}
            onClick={() => scrollByCard(direction)}
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors",
              "hover:bg-white/20 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-white/10",
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
