import type { z } from "zod";

/** Result of a Server Action used with useActionState. */
export interface ActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  /** Non-sensitive values echoed back so the form keeps its input after an error. */
  values?: Record<string, string>;
  /** Optional payload for success states (e.g. a one-time invitation link). */
  result?: Record<string, string>;
}

export const idleState: ActionState = { status: "idle" };

export function fieldErrorsOf(error: z.ZodError): Partial<Record<string, string>> {
  const result: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

export function formValues(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "")]));
}
