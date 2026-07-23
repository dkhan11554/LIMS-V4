import { ConvexProviderWithHerculesAuth } from "@usehercules/auth/convex-react";
import { ConvexReactClient } from "convex/react";
import { useMemo } from "react";

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  const convex = useMemo(() => {
    const convexUrl = import.meta.env.VITE_CONVEX_URL;
    if (!convexUrl) {
      throw new Error("VITE_CONVEX_URL is required for legacy Convex routes.");
    }
    return new ConvexReactClient(convexUrl);
  }, []);

  return (
    <ConvexProviderWithHerculesAuth client={convex}>
      {children}
    </ConvexProviderWithHerculesAuth>
  );
}
