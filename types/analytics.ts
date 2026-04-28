export type ReferrerSource =
  | "direct"
  | "google"
  | "twitter"
  | "slack"
  | "discord"
  | "github"
  | "embed"
  | "other";

export interface ShareView {
  id: number;
  share_id: string;
  viewed_at: string;
  referrer: string | null;
  referrer_source: ReferrerSource | null;
  country_code: string | null;
  visitor_hash: string | null;
  is_unique: boolean;
}

export interface ShareAnalytics {
  total_views: number;
  unique_views: number;
  views_today: number;
  views_7d: number;
  avg_daily_views: number;
}

export interface ViewTimeSeriesPoint {
  date: string;
  views: number;
  unique_views: number;
}

export interface ReferrerBreakdown {
  referrer_source: string;
  views: number;
}

export interface GeoBreakdown {
  country_code: string;
  views: number;
}

export interface TopShare {
  share_id: string;
  slug: string;
  title: string;
  total_views: number;
  unique_views: number;
}
