import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ShareLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Skeleton metadata header */}
      <Card>
        <CardHeader>
          <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
          <div className="flex gap-4">
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        </CardHeader>
      </Card>

      {/* Skeleton iframe area */}
      <Card>
        <CardContent className="p-2">
          <div className="h-[60vh] animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}
