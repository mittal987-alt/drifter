import { useCallback, useEffect, useRef, useState } from "react";
import {
  getGoogleExportStatus,
  type GoogleExportStatus,
} from "@/services/youtube";

interface UseGoogleExportResult {
  status: GoogleExportStatus | null;
  loading: boolean;
  error: string | null;
  isComplete: boolean;
  isFailed: boolean;
}

export function useGoogleExport(
  jobId: number | null,
): UseGoogleExportResult {
  const [status, setStatus] =
    useState<GoogleExportStatus | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const timerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  const poll = useCallback(async () => {
    if (!jobId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result =
        await getGoogleExportStatus(jobId);

      setStatus(result);

      if (
        result.status === "READY" ||
        result.status === "FAILED"
      ) {
        setLoading(false);
        return;
      }

      timerRef.current = setTimeout(
        poll,
        5000,
      );
    } catch (err) {
      console.error(
        "Google export status error:",
        err,
      );

      setError(
        "Could not check Google export status.",
      );

      setLoading(false);

      // Try again after 10 seconds.
      timerRef.current = setTimeout(
        poll,
        10000,
      );
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    poll();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [jobId, poll]);

  return {
    status,
    loading,
    error,
    isComplete:
      status?.status === "READY",
    isFailed:
      status?.status === "FAILED",
  };
}