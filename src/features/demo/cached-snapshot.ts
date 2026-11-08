import { cacheLife } from "next/cache";
import { getDemoReferenceDate } from "@/lib/dates/reference-date";
import { loadDemoSnapshot } from "./snapshot";

/**
 * Demo snapshot for static marketing pages (homepage preview). Cached and
 * refreshed daily; every count is derived from the same dataset as /demo.
 */
export async function getCachedDemoSnapshot() {
  "use cache";
  cacheLife("days");
  return loadDemoSnapshot(getDemoReferenceDate());
}
