import { FileText } from "lucide-react";

interface AnalyticsEmptyStateProps {
  message?: string;
}

export function AnalyticsEmptyState({ message }: AnalyticsEmptyStateProps) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <FileText className="size-12 mx-auto mb-3 opacity-50" />
      <p>{message ?? "No analytics data yet. Share a link and views will appear here."}</p>
    </div>
  );
}
