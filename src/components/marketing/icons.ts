import {
  Boxes,
  CalendarDays,
  CalendarRange,
  Factory,
  FileSpreadsheet,
  FileText,
  Gavel,
  GraduationCap,
  Headset,
  Inbox,
  KeyRound,
  Lightbulb,
  Mail,
  MessagesSquare,
  Replace,
  ShieldCheck,
  TriangleAlert,
  Truck,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Icon keys used in marketing copy files, mapped to one consistent icon set. */
export const marketingIcons: Record<string, LucideIcon> = {
  sheet: FileSpreadsheet,
  mail: Mail,
  user: UserRound,
  file: FileText,
  alert: TriangleAlert,
  inbox: Inbox,
  register: Boxes,
  calendar: CalendarDays,
  chat: MessagesSquare,
  spark: Lightbulb,
  wrench: Wrench,
  gavel: Gavel,
  truck: Truck,
  factory: Factory,
  shield: ShieldCheck,
  headset: Headset,
  graduation: GraduationCap,
  replace: Replace,
  "calendar-range": CalendarRange,
  key: KeyRound,
};

export function getMarketingIcon(key: string): LucideIcon {
  return marketingIcons[key] ?? FileText;
}
