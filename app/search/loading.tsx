import { Card, CardContent } from "@/components/ui/card";

export default function SearchLoading() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Search
        </h1>

        {/* Skeleton search bar */}
        <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />

        {/* Skeleton result cards */}
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2 py-4">
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
