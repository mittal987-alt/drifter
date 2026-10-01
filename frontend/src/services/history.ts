import { apiClient } from "./api";

/* ==========================================================================
   TYPES
   ========================================================================== */

export type HistorySource =
  | "youtube"
  | "spotify"
  | "github"
  | "reddit"
  | "netflix"
  | "steam"
  | "twitter"
  | "browser";

export interface HistoryEvent {
  id: number;
  user_id?: number;

  timestamp: string;
  source: string;

  title: string;
  artist?: string | null;
  topic?: string | null;
  url?: string | null;
  duration?: number | null;

  event_hash?: string;
  metadata_json?: string | null;

  created_at?: string;
}

export interface HistoryResponse {
  count: number;
  events: HistoryEvent[];
}

export interface HistoryImportResponse {
  imported: number;
  duplicates: number;
  skipped: number;
  total_records?: number;
  valid_records?: number;
}

export interface GoogleExportStatus {
  success: boolean;

  job_id: number;

  status:
    | "IN_PROGRESS"
    | "PROCESSING"
    | "READY"
    | "FAILED"
    | string;

  google_state?: string | null;

  message?: string | null;

  error?: string | null;

  imported?: number;
  duplicates?: number;
  skipped?: number;

  total_records?: number;
  valid_records?: number;
}

/* ==========================================================================
   GET HISTORY
   ========================================================================== */

export async function getHistory(
  source?: string,
  limit = 1000,
): Promise<HistoryEvent[]> {
  const response = await apiClient.get<HistoryResponse>(
    "/api/history/events",
    {
      params: {
        ...(source ? { source } : {}),
        limit,
      },
    },
  );

  return response.data.events;
}

/* ==========================================================================
   IMPORT HISTORY
   ========================================================================== */

export async function importHistory(
  file: File,
  source: HistorySource,
): Promise<HistoryImportResponse> {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("source", source);

  const response = await apiClient.post<HistoryImportResponse>(
    "/api/history/import",
    formData
  );

  return response.data;
}

/* ==========================================================================
   GOOGLE DATA PORTABILITY
   ========================================================================== */

export async function getGoogleExportStatus(
  jobId: number,
): Promise<GoogleExportStatus> {
  const response = await apiClient.get<GoogleExportStatus>(
    `/api/youtube/data-portability/status/${jobId}`
  );

  return response.data;
}

/* ==========================================================================
   LATEST GOOGLE EXPORT
   ========================================================================== */

export async function getLatestGoogleExportStatus(): Promise<GoogleExportStatus> {
  const response = await apiClient.get<GoogleExportStatus>(
    "/api/youtube/data-portability/status/latest"
  );

  return response.data;
}

/* ==========================================================================
   DELETE HISTORY EVENT
   ========================================================================== */

export async function deleteHistoryEvent(
  eventId: number,
): Promise<{ success: boolean; event_id: number; message: string }> {
  const response = await apiClient.delete<{ success: boolean; event_id: number; message: string }>(
    `/api/history/events/${eventId}`
  );
  return response.data;
}

/* ==========================================================================
   CLEAR HISTORY
   ========================================================================== */

export async function clearHistory(
  source?: string,
): Promise<{ success: boolean; deleted: number; source?: string }> {
  const response = await apiClient.delete<{ success: boolean; deleted: number; source?: string }>(
    "/api/history/clear",
    {
      params: source ? { source } : {},
    },
  );
  return response.data;
}

/* ==========================================================================
   SERVICE OBJECT
   ========================================================================== */

export const historyService = {
  getHistory,
  importHistory,
  getGoogleExportStatus,
  getLatestGoogleExportStatus,
  deleteHistoryEvent,
  clearHistory,
};