import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000";

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
  const response =
    await axios.get<GoogleExportStatus>(
      `${API_URL}/api/youtube/data-portability/status/${jobId}`,
      {
        withCredentials: true,
      },
    );

  return response.data;
}

export const youtubeService = {
  getGoogleExportStatus,
};