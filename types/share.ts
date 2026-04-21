export interface Share {
  id: string;
  slug: string;
  filename: string;
  storage_path: string;
  content_text: string | null;
  file_size: number | null;
  mime_type: string;
  delete_token: string;
  created_at: string;
  expires_at: string;
  view_count: number;
}

export interface SearchResult {
  slug: string;
  filename: string;
  created_at: string;
  view_count: number;
  expires_at: string;
  snippet: string;
  rank: number;
}
