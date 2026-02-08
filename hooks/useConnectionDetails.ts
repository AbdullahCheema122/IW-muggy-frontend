// hooks/useConnectionDetails.ts
import { useCallback, useEffect, useState } from "react";
import { decodeJwt } from "jose";
import { ConnectionDetails } from "@/app/api/connection-details/route";
import { AppConfig } from "@/lib/types";

const ONE_MINUTE_IN_MILLISECONDS = 60 * 1000;

export default function useConnectionDetails(appConfig: AppConfig) {
  const [connectionDetails, setConnectionDetails] =
    useState<ConnectionDetails | null>(null);

  const fetchConnectionDetails = useCallback(async () => {
    setConnectionDetails(null);

    const url = new URL(
      process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ??
        "/api/connection-details",
      window.location.origin,
    );

    try {
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sandbox-Id": appConfig.sandboxId ?? "",
        },
        body: JSON.stringify({
          room_config: appConfig.agentName
            ? { agents: [{ agent_name: appConfig.agentName }] }
            : undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
      }

      const data: ConnectionDetails = await res.json();
      setConnectionDetails(data);
      return data;
    } catch (error) {
      console.error("Error fetching connection details:", error);
      throw new Error("Error fetching connection details!");
    }
  }, [appConfig]); // ✅ include appConfig

  useEffect(() => {
    fetchConnectionDetails();
  }, [fetchConnectionDetails]);

  const isConnectionDetailsExpired = useCallback(() => {
    const token = connectionDetails?.participantToken;
    if (!token) return true;

    const jwtPayload = decodeJwt(token);
    if (!jwtPayload.exp) return true;

    // exp is in SECONDS; convert to ms and refresh 1 minute early
    const expiresAtMs = Number(jwtPayload.exp) * 1000;
    const refreshAtMs = expiresAtMs - ONE_MINUTE_IN_MILLISECONDS;

    // If we are past the refresh time, we consider it "expired" for our purposes
    return Date.now() >= refreshAtMs; // ✅ correct direction
  }, [connectionDetails?.participantToken]);

  const existingOrRefreshConnectionDetails = useCallback(async () => {
    if (isConnectionDetailsExpired() || !connectionDetails) {
      return fetchConnectionDetails();
    }
    return connectionDetails;
  }, [connectionDetails, fetchConnectionDetails, isConnectionDetailsExpired]);

  return {
    connectionDetails,
    refreshConnectionDetails: fetchConnectionDetails,
    existingOrRefreshConnectionDetails,
  };
}
