import { serve } from "@hono/node-server";
import { createApp } from "./app";

const app = createApp();
const port = Number(process.env.PORT) || 3001;

serve({ fetch: app.fetch, port });

console.log(`API server running on http://localhost:${port}`);
