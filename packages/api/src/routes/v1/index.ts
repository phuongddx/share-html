/**
 * v1 API route aggregator.
 * Mounts all v1 sub-routes under /api/v1.
 */

import { Hono } from "hono";
import { documents } from "./documents";
import { documentsSlug } from "./documents-slug";
import { keys } from "./keys";
import { keysId } from "./keys-id";
import type { AppEnv } from "../../app";

const v1 = new Hono<AppEnv>();

v1.route("/documents", documents);
v1.route("/documents", documentsSlug);
v1.route("/keys", keys);
v1.route("/keys", keysId);

export { v1 };
