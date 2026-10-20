import { TooltipProvider } from "@/components/ui/tooltip";
import { useMeta } from "@/hooks/use-run";
import { I18nContext, i18nFor } from "@/i18n";
import { useTheme } from "@/lib/theme";
import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Toaster } from "sonner";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
});

function Root() {
  const meta = useMeta();
  const locale = meta.data?.locale ?? "en";
  const i18n = useMemo(() => i18nFor(locale), [locale]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <I18nContext.Provider value={i18n}>
      <TooltipProvider delayDuration={200}>
        <Outlet />
        <AppToaster />
      </TooltipProvider>
    </I18nContext.Provider>
  );
}

/**
 * Toasts in the design system's look: card surface, 1px border, Montserrat. Bottom-right
 * (bottom-center on mobile) so they never cover the header menus — the bell popover
 * included — which all open top-right.
 */
function AppToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      offset={24}
      mobileOffset={16}
      visibleToasts={4}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border !border-border !bg-card !text-card-foreground !font-sans !shadow-md",
          description: "!text-muted-foreground",
          actionButton: "!rounded-sm !bg-primary !text-primary-foreground !font-medium",
          icon: "[&_svg]:!size-4",
          warning: "[&_[data-icon]]:!text-warning-foreground",
          success: "[&_[data-icon]]:!text-success-foreground",
        },
      }}
    />
  );
}
