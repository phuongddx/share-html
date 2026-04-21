export default function RootLoading() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <div
          className="size-8 animate-spin rounded-full border-4 border-muted border-t-foreground"
          role="status"
          aria-label="Loading"
        />
        <p className="text-sm font-medium text-muted-foreground">
          Share HTML
        </p>
      </div>
    </div>
  );
}
