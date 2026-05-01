import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { createAdminClient } from "@dropitx/shared/supabase/admin";
import type { AppEnv } from "../app";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);
const MAX_SIZE = 5 * 1024 * 1024;
const STORAGE_BUCKET = "html-files";

const imagesUpload = new Hono<AppEnv>();

imagesUpload.post("/", requireAuth, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return c.json({ error: "No file" }, 400);
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return c.json(
        { error: "Unsupported type. Only png, jpg, gif, webp allowed." },
        400
      );
    }
    if (file.size > MAX_SIZE) {
      return c.json({ error: "File too large. Max 5MB." }, 400);
    }

    const auth = c.get("auth");

    const ext = file.name.split(".").pop() ?? "png";
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const path = `uploads/${auth.userId}/${filename}`;

    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: false });

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

    return c.json({ url: publicUrl, filename: file.name });
  } catch (err) {
    console.error("Image upload error:", err);
    return c.json({ error: "Upload failed" }, 500);
  }
});

export { imagesUpload };
