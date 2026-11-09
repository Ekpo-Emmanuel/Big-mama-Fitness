function firstIssue(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const issues = (value as { issues?: { message?: string }[] }).issues;
  const message = issues?.[0]?.message;
  return typeof message === "string" ? message.trim() : "";
}

function fromData(data: unknown): string {
  if (typeof data === "string") return data.trim();
  if (!data || typeof data !== "object") return "";
  const issue = firstIssue(data);
  if (issue) return issue;
  const message = (data as { message?: unknown }).message;
  return typeof message === "string" ? message.trim() : "";
}

function tidy(message: string): string {
  const json = message.match(/ConvexError:\s*(\{[\s\S]*\})/);
  if (json) {
    try {
      return fromData(JSON.parse(json[1]));
    } catch {
      /* use other patterns */
    }
  }
  const named = message.match(/ConvexError:\s*(.+?)(?:\n|$)/);
  if (named) return named[1].replace(/\s*\[Request ID.*/, "").trim();
  if (
    /\[CONVEX|Uncaught|Minified React|Cannot read properties|is not defined/.test(
      message,
    )
  )
    return "";
  return message.trim();
}

export function adminErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return tidy(error) || fallback;
  if (!error || typeof error !== "object") return fallback;
  const record = error as {
    data?: unknown;
    message?: string;
    cause?: unknown;
  };
  const fromIssue = firstIssue(record);
  if (fromIssue) return fromIssue;
  const fromPayload = fromData(record.data);
  if (fromPayload) return tidy(fromPayload) || fromPayload;
  if (record.cause) {
    const nested = adminErrorMessage(record.cause, "");
    if (nested) return nested;
  }
  if (typeof record.message === "string")
    return tidy(record.message) || fallback;
  return fallback;
}

export function publicPageError(error: Error): string {
  return (
    adminErrorMessage(
      error,
      "Check your connection and try again. Your saved information is unchanged.",
    ) ||
    "Check your connection and try again. Your saved information is unchanged."
  );
}
