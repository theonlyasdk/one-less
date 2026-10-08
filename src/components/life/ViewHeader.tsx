import { Fragment } from "react";
import { ArrowLeftIcon } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

export interface Crumb {
  label: string;
  /** Omit on the final crumb, which is the current page. */
  onClick?: () => void;
}

interface ViewHeaderProps {
  crumbs: Crumb[];
  /** Slides the final segment out before it is retired. */
  exiting?: boolean;
}

/**
 * `← Life / 2028–2029 / Week 14`
 *
 * The back control is a bare arrow; the path beside it carries the labels.
 * Every ancestor crumb is also clickable, so the whole line zooms out.
 *
 * Only the final segment animates. Ancestors carry no animation class and are
 * keyed by their own label, so when the path deepens React moves those existing
 * nodes rather than remounting them — they hold perfectly still while the one
 * new last crumb slides in.
 */
export function ViewHeader({ crumbs, exiting = false }: ViewHeaderProps) {
  const ancestors = crumbs.slice(0, -1);
  const current = crumbs.at(-1);
  const parent = ancestors.at(-1);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        disabled={!parent?.onClick}
        onClick={parent?.onClick}
        aria-label={parent ? `Back to ${parent.label}` : "Back"}
      >
        <ArrowLeftIcon />
      </Button>

      <Breadcrumb>
        <BreadcrumbList>
          {ancestors.map((crumb) => (
            <Fragment key={crumb.label}>
              <BreadcrumbItem>
                {crumb.onClick ? (
                  <BreadcrumbLink asChild>
                    <button type="button" onClick={crumb.onClick} className="cursor-pointer">
                      {crumb.label}
                    </button>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </Fragment>
          ))}
          {current ? (
            <BreadcrumbItem
              key={current.label}
              className="crumb"
              data-exiting={exiting || undefined}
            >
              <BreadcrumbPage>{current.label}</BreadcrumbPage>
            </BreadcrumbItem>
          ) : null}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
