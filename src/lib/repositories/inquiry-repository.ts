import type { InterestArea } from "@/lib/validation/inquiry-schemas";

/**
 * Persistence boundary for public inquiries. Route handlers depend on these
 * interfaces, which keeps them testable with in-memory implementations and
 * lets the storage backend change without touching validation logic.
 */

export interface DemoRequestRecord {
  fullName: string;
  email: string;
  interestArea: InterestArea;
  message: string | null;
  marketingOptIn: boolean;
  consentVersion: string | null;
  privacyNoticeVersion: string;
  source: string;
}

export interface ContactMessageRecord {
  fullName: string;
  email: string;
  message: string;
  privacyNoticeVersion: string;
  source: string;
}

export interface InquiryRepository {
  /**
   * Stores a pilot/demo request. Repeated requests (same e-mail and interest
   * within the deduplication window) are merged by the database; the caller
   * receives the same result either way, so the response never reveals
   * whether an e-mail address already exists.
   */
  saveDemoRequest(record: DemoRequestRecord): Promise<void>;
  saveContactMessage(record: ContactMessageRecord): Promise<void>;
}

export interface RateLimiter {
  /** Records one attempt and returns false when the limit for the window is exceeded. */
  consume(bucket: string, keyHash: string, limit: number, windowSeconds: number): Promise<boolean>;
}

export class PersistenceError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "PersistenceError";
  }
}
