import type { ReactNode } from "react"
import {
  Button as DialogClosePrimitive,
  Dialog as DialogPrimitive,
  DialogTrigger as DialogTriggerPrimitive,
  Heading,
  Modal,
  ModalOverlay,
  Text,
  type DialogTriggerProps,
  type ModalOverlayProps,
} from "react-aria-components"

import { Button, type buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { VariantProps } from "class-variance-authority"

const DialogTrigger = DialogTriggerPrimitive

type DialogProps = Omit<ModalOverlayProps, "children" | "className"> & {
  children: ReactNode
  /** Classes applied to the dialog panel (e.g. `sm:max-w-sm`). */
  className?: string
}

function Dialog({ children, className, isDismissable = true, ...props }: DialogProps) {
  return (
    <ModalOverlay
      data-slot="dialog-overlay"
      isDismissable={isDismissable}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5"
      {...props}
    >
      <Modal
        data-slot="dialog-modal"
        className="w-full outline-none"
      >
        <DialogPrimitive
          data-slot="dialog-panel"
          className={cn(
            "w-full rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg outline-none sm:max-w-md",
            className
          )}
        >
          {children}
        </DialogPrimitive>
      </Modal>
    </ModalOverlay>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("mb-4 flex flex-col gap-1.5 text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof Heading>) {
  return (
    <Heading
      slot="title"
      data-slot="dialog-title"
      className={cn("text-base font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text
      slot="description"
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function DialogClose({
  className,
  variant = "outline",
  size = "default",
  ...props
}: React.ComponentProps<typeof DialogClosePrimitive> &
  VariantProps<typeof buttonVariants>) {
  return (
    <Button slot="close" variant={variant} size={size} className={className} {...props} />
  )
}

export {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  type DialogTriggerProps,
}
