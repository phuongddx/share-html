import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md text-center animate-fade-in">
        <CardHeader className="items-center gap-3 pb-2">
          <div className="size-14 rounded-md bg-destructive/10 flex items-center justify-center">
            <FileX className="size-7 text-destructive" />
          </div>
          <CardTitle className="font-mono text-2xl">&gt; 404</CardTitle>
          <CardDescription>
            This link doesn&apos;t exist or has expired
          </CardDescription>
        </CardHeader>
        <CardContent className="justify-center">
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Back to home
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
