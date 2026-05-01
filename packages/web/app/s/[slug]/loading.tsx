import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ShareLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 max-w-[1200px] mx-auto w-full">
      <Card className="animate-fade-in">
        <CardHeader className="gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-5" />
            <Skeleton className="h-5 w-1/2" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </CardHeader>
      </Card>

      <Card className="animate-fade-in">
        <CardContent className="p-2">
          <Skeleton className="h-[60vh] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
