import type { ComponentProps } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

function Breadcrumb({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      data-slot="breadcrumb"
      aria-label="breadcrumb"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function BreadcrumbList({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      {...props}
    />
  )
}

function BreadcrumbItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    />
  )
}

type BreadcrumbLinkProps = Omit<ComponentProps<"button">, "color"> & {
  href?: string
}

function BreadcrumbLink({ className, href, onClick, children, ...props }: BreadcrumbLinkProps) {
  const classes = cn(
    "cursor-pointer rounded transition-colors outline-none hover:text-foreground",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
    className
  )
  if (href !== undefined) {
    return (
      <a
        data-slot="breadcrumb-link"
        href={href}
        onClick={onClick as unknown as ComponentProps<"a">["onClick"]}
        className={classes}
        {...(props as unknown as ComponentProps<"a">)}
      >
        {children}
      </a>
    )
  }
  return (
    <button
      data-slot="breadcrumb-link"
      type="button"
      onClick={onClick}
      className={classes}
      {...props}
    >
      {children}
    </button>
  )
}

function BreadcrumbPage({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      aria-disabled="true"
      role="link"
      className={cn("font-normal text-foreground", className)}
      {...props}
    />
  )
}

function BreadcrumbSeparator({ children, className, ...props }: ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <span className="text-muted-foreground/60">/</span>}
    </li>
  )
}

function BreadcrumbEllipsis({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      aria-hidden="true"
      className={cn("flex size-5 items-center justify-center", className)}
      {...props}
    >
      <HugeiconsIcon icon={MoreHorizontalIcon} size={14} strokeWidth={2} />
      <span className="sr-only">More</span>
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
}
