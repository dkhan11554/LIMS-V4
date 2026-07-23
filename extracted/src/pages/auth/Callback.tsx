import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCallback, useUser } from "@usehercules/auth/react";
import {
  syncAuthenticatedUser,
  type AuthenticatedUser,
} from "@/lib/api-client.ts";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Button } from "@/components/ui/button.tsx";

export default function AuthCallback() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { access_token: accessToken } = useUser();

  const onSync = useCallback(async () => {
    if (!accessToken) {
      throw new Error(
        "Microsoft Entra did not return an API access token. Please sign in again.",
      );
    }

    const user = await syncAuthenticatedUser(accessToken);
    queryClient.setQueryData<AuthenticatedUser>(["auth", "current-user"], user);
  }, [accessToken, queryClient]);

  const navigateDashboard = useCallback(
    () => navigate("/dashboard", { replace: true }),
    [navigate],
  );

  const { status, error, retry } = useAuthCallback({
    onSync,
    onSuccess: navigateDashboard,
    onNoAuthParams: navigateDashboard,
  });

  if (status === "error" && error) {
    return (
      <div className="flex flex-col items-center justify-center h-svh gap-6 px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-destructive font-medium">Something went wrong</p>
          <p className="text-sm text-muted-foreground max-w-md">{error}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={navigateDashboard}>
            Return home
          </Button>
          <Button onClick={retry}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-svh gap-4">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}
