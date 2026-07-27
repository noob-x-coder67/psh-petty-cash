// The Build Plan (§3.5) describes a `{ data, error: { code, message, details } }` error
// envelope produced by a global AllExceptionsFilter — that filter doesn't exist in the
// API yet (confirmed by reading every controller: no APP_FILTER is registered anywhere),
// so every endpoint today returns Nest's raw default shape instead:
// `{ statusCode, message, error }`, where `message` can be a string, a string[], or (for
// ZodValidationPipe failures) a Zod `flatten()` object `{ formErrors, fieldErrors }`.
// This client is built against that actual shape. If/when the envelope is added, this is
// the one place that needs to change.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(ApiError.extractMessage(body));
    this.name = "ApiError";
  }

  private static extractMessage(body: unknown): string {
    if (body && typeof body === "object" && "message" in body) {
      const message = (body as { message: unknown }).message;
      if (typeof message === "string") return message;
      if (Array.isArray(message)) return message.filter((m) => typeof m === "string").join(", ");
      if (message && typeof message === "object") {
        const flat = message as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
        const parts = [...(flat.formErrors ?? []), ...Object.values(flat.fieldErrors ?? {}).flat()];
        if (parts.length > 0) return parts.join(", ");
      }
    }
    return "Request failed";
  }
}
