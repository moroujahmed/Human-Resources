export function parseCorsOrigins(
  rawOrigins: string | undefined,
  requireExplicit = false,
): string[] {
  if (requireExplicit && rawOrigins === undefined) {
    throw new Error("CORS_ORIGIN must be explicitly configured in production");
  }

  const origins = (rawOrigins ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim());

  if (
    origins.length === 0 ||
    origins.some(
      (origin) =>
        origin.length === 0 ||
        origin === "null" ||
        origin.includes("*") ||
        !isExactHttpOrigin(origin),
    )
  ) {
    throw new Error("CORS_ORIGIN must contain exact HTTP(S) origins only");
  }

  if (
    requireExplicit &&
    origins.some((origin) => new URL(origin).protocol !== "https:")
  ) {
    throw new Error("CORS_ORIGIN must use HTTPS in production");
  }

  return origins;
}

function isExactHttpOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.origin === origin
    );
  } catch {
    return false;
  }
}
