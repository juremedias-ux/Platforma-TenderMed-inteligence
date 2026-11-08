/** Demo workspace views, addressable with `/demo?pogled=<view>`. Shared by server and client code. */
export type DemoView = "pregled" | "oprema" | "servisi" | "priporocila" | "razpisi";

export const demoViews: DemoView[] = ["pregled", "oprema", "servisi", "priporocila", "razpisi"];

export function parseDemoView(value: unknown): DemoView {
  return typeof value === "string" && (demoViews as string[]).includes(value) ? (value as DemoView) : "pregled";
}
