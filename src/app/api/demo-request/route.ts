import { demoRequestDefinition, handleInquiry } from "@/lib/forms/handle-inquiry";
import { inquiryServerDependencies } from "@/lib/forms/server-dependencies";

/** Pilot / demo inquiry endpoint. Only POST is exported; other methods receive 405. */
export async function POST(request: Request): Promise<Response> {
  return handleInquiry(request, demoRequestDefinition, inquiryServerDependencies);
}
