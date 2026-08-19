import { CustomerInputError } from "@/modules/customer/service";
import { QuoteAccessError, QuoteConflictError, QuoteExpiredError, QuoteInputError, QuoteNotFoundError } from "@/modules/quotes/service";
import { ServiceAreaError } from "@/modules/service-area/service";
import { SchedulingConflictError, SchedulingInputError, SchedulingUnavailableError } from "./service";

export function schedulingApiError(error: unknown): Response {
  if (error instanceof SchedulingInputError || error instanceof QuoteInputError) {
    return Response.json({ error: error.message, fields: error.fields }, { status: 400 });
  }
  if (error instanceof CustomerInputError) return Response.json({ error: error.code, fields: error.fields }, { status: 400 });
  if (error instanceof ServiceAreaError) return Response.json({ error: error.result.reason, fields: { address: error.result.message } }, { status: 400 });
  if (error instanceof QuoteExpiredError) return Response.json({ error: "QUOTE_EXPIRED" }, { status: 410 });
  if (error instanceof SchedulingUnavailableError) return Response.json({ error: error.message }, { status: 409 });
  if (error instanceof SchedulingConflictError || error instanceof QuoteConflictError) return Response.json({ error: error.message }, { status: 409 });
  if (error instanceof QuoteNotFoundError || error instanceof QuoteAccessError) return Response.json({ error: "QUOTE_NOT_FOUND" }, { status: 404 });
  return Response.json({ error: "SCHEDULING_SERVICE_UNAVAILABLE" }, { status: 503, headers: { "Retry-After": "30" } });
}
