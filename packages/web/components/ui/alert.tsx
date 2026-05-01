import * as React from "react"

import { cn } from "@dropitx/shared/utils/cn"

function Alert({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { variant?: "default" | "destructive" }) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(
        "relative flex w-full items-start gap-3 rounded-lg border border-border px-4 py-3 text-sm",
        variant === "destructive" && "border-red-500/50 text-red-600",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-sm [&>p]:leading-relaxed", className)}
      {...props}
    />
  )
}

export { Alert, AlertDescription }
