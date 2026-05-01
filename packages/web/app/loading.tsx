export default function RootLoading() {
  return (
    <div className="flex flex-1 items-center justify-center p-4 animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div
            className="size-8 animate-spin rounded-md border-2 border-muted"
            style={{ borderTopColor: "var(--primary)" }}
            role="status"
            aria-label="Loading"
          />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          DropItX
        </p>
      </div>
    </div>
  );
}
