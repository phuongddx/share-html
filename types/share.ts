export interface Share {
  id: string;
  slug: string;
  filename: string;
  storage_path: string;
  content_text: string | null;
  file_size: number | null;
  mime_type: string;
  delete_token: string;
  user_id: string | null;
  title: string | null;
  custom_slug: string | null;
  source: string | null;
  is_private: boolean;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
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
