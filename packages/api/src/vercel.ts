import { handle } from "hono/vercel";
import { createApp } from "./app";

const app = createApp();

export default handle(app);

// Vercel requires named exports for each HTTP method
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
