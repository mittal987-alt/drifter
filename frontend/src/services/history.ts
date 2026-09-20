import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

/* ==========================================================================
   TYPES
   ========================================================================== */

export type HistorySource = "youtube" | "spotify";

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

  /*
   * Backend status.
   *
   * IN_PROGRESS
   * PROCESSING
   * READY
   * FAILED
   */
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
  const response =
    await axios.get<HistoryResponse>(
      `${API_URL}/api/history/events`,
      {
        params: {
          ...(source
            ? { source }
            : {}),
          limit,
        },

        withCredentials: true,
      },
    );

  /*
   * Backend returns:
   *
   * {
   *   count: number,
   *   events: [...]
   * }
   *
   * The React application expects only the array.
   */
  return response.data.events;
}

/* ==========================================================================
   IMPORT HISTORY
   ========================================================================== */

export async function importHistory(
  file: File,
  source: "youtube" | "spotify",
): Promise<HistoryImportResponse> {
  const formData = new FormData();

  formData.append(
    "file",
    file,
  );

  formData.append(
    "source",
    source,
  );

  const response =
    await axios.post<HistoryImportResponse>(
      `${API_URL}/api/history/import`,
      formData,
      {
        withCredentials: true,
      },
    );

  return response.data;
}

/* ==========================================================================
   GOOGLE DATA PORTABILITY
   ========================================================================== */

export async function getGoogleExportStatus(
  jobId: number,
): Promise<GoogleExportStatus> {
  const response =
    await axios.get<GoogleExportStatus>(
      `${API_URL}/api/youtube/data-portability/status/${jobId}`,
      {
        withCredentials: true,
      },
    );

  return response.data;
}

/* ==========================================================================
   LATEST GOOGLE EXPORT
   ========================================================================== */

export async function getLatestGoogleExportStatus(): Promise<GoogleExportStatus> {
  const response =
    await axios.get<GoogleExportStatus>(
      `${API_URL}/api/youtube/data-portability/status/latest`,
      {
        withCredentials: true,
      },
    );

  return response.data;
}

/* ==========================================================================
   DELETE HISTORY EVENT
   ========================================================================== */

export async function deleteHistoryEvent(
  eventId: number,
): Promise<{ success: boolean; event_id: number; message: string }> {
  const response = await axios.delete<{ success: boolean; event_id: number; message: string }>(
    `${API_URL}/api/history/events/${eventId}`,
    { withCredentials: true },
  );
  return response.data;
}

/* ==========================================================================
   CLEAR HISTORY
   ========================================================================== */

export async function clearHistory(
  source?: string,
): Promise<{ success: boolean; deleted: number; source?: string }> {
  const response = await axios.delete<{ success: boolean; deleted: number; source?: string }>(
    `${API_URL}/api/history/clear`,
    {
      params: source ? { source } : {},
      withCredentials: true,
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