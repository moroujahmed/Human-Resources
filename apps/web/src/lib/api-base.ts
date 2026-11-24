const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

// Accept older deployment values that included the API prefix. Call sites add it.
export const API_BASE =
  configuredApiUrl?.replace(/\/api\/v1$/i, "") ?? "http://localhost:4000";
