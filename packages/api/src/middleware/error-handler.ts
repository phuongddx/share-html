import type { ErrorHandler } from "hono";

export const errorHandler: ErrorHandler = (err, c) => {
  console.error(`[${c.req.method}] ${c.req.path} →`, err);

  const status = "status" in err ? (err.status as number) : 500;
  const message =
    status < 500 ? (err.message || "Bad request") : "Internal server error";

  return c.json({ error: message }, status as 400 | 401 | 403 | 404 | 409 | 429 | 500);
};
