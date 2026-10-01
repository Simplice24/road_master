export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

/** Machine-readable error codes the backend attaches to some failures. */
export const API_ERROR_CODES = {
  /** 403 on exam start: no free exam, no active time plan, no bundle attempts → go to pricing. */
  subscriptionRequired: "SUBSCRIPTION_REQUIRED",
  /** 400 on plan purchase: the wallet can't cover the price → offer a top-up. */
  insufficientFunds: "INSUFFICIENT_FUNDS",
} as const;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON-serialized, except FormData (file uploads), which is sent as multipart as-is. */
  body?: unknown;
  token?: string | null;
}

function extractMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message: unknown }).message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }
  return fallback;
}

function extractCode(payload: unknown): string | undefined {
  if (payload && typeof payload === "object" && "code" in payload) {
    const code = (payload as { code: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

export async function apiFetch<T>(
  path: string,
  { method = "GET", body, token }: RequestOptions = {},
): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = {};
  // FormData sets its own multipart Content-Type (with the boundary) — never override it.
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractMessage(payload, "Something went wrong. Please try again."),
      extractCode(payload),
    );
  }

  return payload as T;
}
