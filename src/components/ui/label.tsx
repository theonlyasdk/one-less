import {
  Label as LabelPrimitive,
  type LabelProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"

function Label({ className, ...props }: LabelProps) {
  return (
    <LabelPrimitive
      data-slot="label"
      className={cn(
        "text-sm font-medium text-foreground",
        "group-disabled:pointer-events-none group-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
