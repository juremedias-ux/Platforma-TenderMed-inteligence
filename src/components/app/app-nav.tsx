"use client";

import {
  Bell,
  Boxes,
  CalendarDays,
  LayoutDashboard,
  Lightbulb,
  Library,
  Settings,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export type AppNavKey =
  "pregled" | "oprema" | "servisi" | "koledar" | "katalog" | "priporocila" | "obvestila" | "nastavitve";

const items: Record<AppNavKey, { label: string; icon: LucideIcon }> = {
  pregled: { label: "Pregled", icon: LayoutDashboard },
  oprema: { label: "Oprema", icon: Boxes },
  servisi: { label: "Servisi", icon: Wrench },
  koledar: { label: "Koledar", icon: CalendarDays },
  katalog: { label: "Katalog", icon: Library },
  priporocila: { label: "Priporočila", icon: Lightbulb },
  obvestila: { label: "Obvestila", icon: Bell },
  nastavitve: { label: "Nastavitve", icon: Settings },
};

export function AppNav({
  organizationId,
  keys,
  badges = {},
}: {
  organizationId: string;
  keys: AppNavKey[];
  badges?: Partial<Record<AppNavKey, number>>;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigacija aplikacije" className="relative">
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:overflow-visible">
        {keys.map((key) => {
          const href = `/app/${organizationId}/${key}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const Item = items[key];
          return (
            <li key={key} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "bg-navy-900 text-white" : "text-ink-soft hover:bg-subtle hover:text-ink",
                )}
              >
                <Item.icon className="size-4" aria-hidden="true" />
                {Item.label}
                {badges[key] ? (
                  <span className="ml-auto rounded-full bg-accent-600 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white">
                    {badges[key]}
                    <span className="sr-only"> neprebranih</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
