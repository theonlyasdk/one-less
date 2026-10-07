import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

function FieldGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("grid w-full gap-4", className)}
      {...props}
    />
  )
}

function Field({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="field" className={cn("grid w-full gap-2", className)} {...props} />
  )
}

export { Field, FieldGroup }
