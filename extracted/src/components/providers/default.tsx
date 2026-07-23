import { AuthProvider } from "./auth.tsx";
import { ConvexProvider } from "./convex.tsx";
import { QueryClientProvider } from "./query-client.tsx";
import { ThemeProvider } from "./theme.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";
import { useLocation } from "react-router-dom";

const FASTAPI_ONLY_ROUTES = new Set(["/", "/auth/callback", "/dashboard"]);

function RouteAwareConvexProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { pathname } = useLocation();

  return FASTAPI_ONLY_ROUTES.has(pathname) ? (
    <>{children}</>
  ) : (
    <ConvexProvider>{children}</ConvexProvider>
  );
}

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RouteAwareConvexProvider>
        <QueryClientProvider>
          <TooltipProvider>
            <ThemeProvider>
              <Toaster />
              {children}
            </ThemeProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </RouteAwareConvexProvider>
    </AuthProvider>
  );
}
