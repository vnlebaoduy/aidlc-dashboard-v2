// Page scaffolding shared by every route: title + lead, section cards, empty/error/
// loading states. Consistency lives here, not in each page.

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { apiErrorText } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  lead,
  actions,
}: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold leading-8 tracking-tight">{title}</h1>
        {lead ? <p className="max-w-3xl text-sm text-muted-foreground">{lead}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** A titled card section. `icon` is a lucide element at size-4. */
export function Section({
  title,
  icon,
  description,
  action,
  children,
  className,
  contentClassName,
  id,
}: {
  title: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  id?: string;
}) {
  return (
    <Card id={id} className={cn("scroll-mt-20", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon ? <span className="text-muted-foreground [&_svg]:size-4">{icon}</span> : null}
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn("min-w-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-xs leading-5 text-muted-foreground", className)}>{children}</p>;
}

export function Empty({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function WarnNote({ children }: { children: ReactNode }) {
  return (
    <Alert className="border-warning/40 bg-warning/5">
      <TriangleAlertIcon className="text-warning-foreground" aria-hidden />
      <AlertDescription className="text-foreground/80">{children}</AlertDescription>
    </Alert>
  );
}

export function ErrorState({ error, action }: { error: unknown; action?: ReactNode }) {
  const { s } = useI18n();
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>{s.errorPage.heading}</AlertTitle>
      <AlertDescription>
        <p>{apiErrorText(error, s)}</p>
        {action}
      </AlertDescription>
    </Alert>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

/** Labelled figure for stat grids. */
export function Stat({
  label,
  value,
  sub,
  tone,
  dashed,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: string;
  dashed?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border bg-card px-4 py-3", dashed && "border-dashed")}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular", tone)}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
