import { apiClient } from "./api";

export interface GoogleExportStatus {
  success: boolean;
  job_id: number;
  status: "IN_PROGRESS" | "PROCESSING" | "READY" | "FAILED";
  google_state?: string;
  message?: string;
  error?: string;
  imported?: number;
  duplicates?: number;
  skipped?: number;
}

export async function getGoogleExportStatus(
  jobId: number,
): Promise<GoogleExportStatus> {
  const response = await apiClient.get<GoogleExportStatus>(
    `/api/youtube/data-portability/status/${jobId}`
  );

  return response.data;
}

export const youtubeService = {
  getGoogleExportStatus,
};