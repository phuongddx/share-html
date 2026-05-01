import { requireAuth } from "./config.js";

interface PublishOptions {
  title?: string;
  isPrivate?: boolean;
  customSlug?: string;
  password?: string;
}

interface PublishResult {
  slug: string;
  url: string;
  title: string;
  filename: string;
}

interface UpdateResult {
  slug: string;
  url: string;
  updated_at: string;
}

interface ListResult {
  documents: Array<{
    slug: string;
    filename: string;
    title: string | null;
    created_at: string;
    view_count: number;
    is_private: boolean;
  }>;
  total: number;
}

export class ShareHtmlClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    const auth = requireAuth();
    this.baseUrl = (baseUrl ?? auth.baseUrl).replace(/\/+$/, "");
    this.apiKey = apiKey ?? auth.apiKey;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async publish(content: string, filename: string, opts?: PublishOptions): Promise<PublishResult> {
    const res = await fetch(`${this.baseUrl}/v1/documents`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        content,
        filename,
        title: opts?.title,
        is_private: opts?.isPrivate,
        custom_slug: opts?.customSlug,
        password: opts?.password,
      }),
    });
    if (!res.ok) await this.throwError(res);
    return res.json();
  }

  async update(slug: string, content: string, opts?: { title?: string; filename?: string }): Promise<UpdateResult> {
    const res = await fetch(`${this.baseUrl}/v1/documents/${slug}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify({ content, ...opts }),
    });
    if (!res.ok) await this.throwError(res);
    return res.json();
  }

  async delete(slug: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/v1/documents/${slug}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) await this.throwError(res);
  }

  async list(limit = 20, offset = 0): Promise<ListResult> {
    const res = await fetch(`${this.baseUrl}/v1/documents?limit=${limit}&offset=${offset}`, {
      headers: this.headers(),
    });
    if (!res.ok) await this.throwError(res);
    return res.json();
  }

  async whoami(): Promise<{ user_id: string }> {
    const res = await fetch(`${this.baseUrl}/v1/documents?limit=1`, {
      headers: this.headers(),
    });
    if (!res.ok) await this.throwError(res);
    return { user_id: "authenticated" };
  }

  private async throwError(res: Response): Promise<never> {
    let msg = `API error ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
}
