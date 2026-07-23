const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  display_name: string | null;
  roles: string[];
  permissions: string[];
}

export interface DashboardStatistics {
  total: number;
  inProgress: number;
  pendingReview: number;
  completed: number;
  overdue: number;
  statusCounts: Record<string, number>;
  volumeByDay: Array<{ date: string; count: number }>;
  byPriority: {
    routine: number;
    urgent: number;
    stat: number;
  };
  avgTatDays: number;
  recentSamples: Array<{
    _id: string;
    limsNumber: string;
    sampleName: string;
    customerName: string;
    priority: string;
    status: string;
  }>;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function getErrorMessage(body: unknown, status: number): string {
  if (status === 401) {
    return "Your Microsoft Entra session is invalid or expired. Please sign in again.";
  }

  if (
    status === 403 &&
    typeof body === "object" &&
    body !== null &&
    "detail" in body &&
    body.detail === "User account is not active"
  ) {
    return "Your account is awaiting activation. Ask an administrator to activate your LIMS account.";
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "detail" in body &&
    typeof body.detail === "string"
  ) {
    return body.detail;
  }

  return `The API request failed (${status}).`;
}

async function request<T>(
  path: string,
  accessToken: string,
  method: "GET" | "POST" = "GET",
): Promise<T> {
  if (!apiBaseUrl) {
    throw new Error("VITE_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiClientError(getErrorMessage(body, response.status), response.status);
  }

  return body as T;
}

export function syncAuthenticatedUser(
  accessToken: string,
): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>("/auth/sync", accessToken, "POST");
}

export function getDashboardStatistics(
  accessToken: string,
): Promise<DashboardStatistics> {
  return request<DashboardStatistics>("/dashboard/statistics", accessToken);
}
