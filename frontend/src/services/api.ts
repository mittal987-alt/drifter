import axios from "axios";

export const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000, // 15s timeout to prevent infinite page hanging
  withCredentials: true,
});
