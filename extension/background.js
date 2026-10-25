// background.js - Service Worker for Multi-Platform History Sync (YouTube, Spotify, Netflix, GitHub, Reddit, Steam, Twitter/X, Web)
const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";
const ALARM_NAME = "DRIFTER_SYNC_ALARM";

// Ensure periodic alarm is scheduled (every 60 minutes)
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 });
  console.log("[Drifter Sync] Service worker installed & sync alarm initialized.");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    flushQueueToBackend();
  }
});

// Listen for messages from content.js or popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "YOUTUBE_WATCH_EVENT" || message.type === "DRIFTER_TRACE_EVENT") {
    handleIncomingWatchEvent(message.payload);
    sendResponse({ status: "queued" });
  } else if (message.type === "TRIGGER_SYNC_NOW") {
    flushQueueToBackend().then((result) => sendResponse(result));
    return true; // async response
  }
});

async function getStorageData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [
        "backendUrl",
        "syncToken",
        "watchQueue",
        "lastSyncTime",
        "lastSyncStatus",
        "lastSyncError",
      ],
      (data) => {
        resolve({
          backendUrl: (data.backendUrl || DEFAULT_BACKEND_URL).trim(),
          syncToken: (data.syncToken || "").trim(),
          watchQueue: data.watchQueue || [],
          lastSyncTime: data.lastSyncTime || null,
          lastSyncStatus: data.lastSyncStatus || "IDLE",
          lastSyncError: data.lastSyncError || null,
        });
      }
    );
  })
}

let isFlushing = false;

function safeDateString(val) {
  try {
    const d = new Date(val || Date.now());
    return isNaN(d.getTime()) ? new Date().toISOString().split("T")[0] : d.toISOString().split("T")[0];
  } catch (e) {
    return new Date().toISOString().split("T")[0];
  }
}

async function handleIncomingWatchEvent(event) {
  if (!event || (!event.title && !event.videoId)) return;

  const data = await getStorageData();
  const queue = data.watchQueue;

  const todayStr = safeDateString(event.watchedAt);

  // Deduplicate properly per platform
  const existingIdx = queue.findIndex((q) => {
    const qDate = safeDateString(q.watchedAt);
    if (qDate !== todayStr) return false;

    // YouTube: match videoId
    if (event.videoId && q.videoId) {
      return q.videoId === event.videoId;
    }
    // URL-based platforms: match exact URL
    if (event.url && q.url) {
      return q.url === event.url;
    }
    // Fallback: match title and source
    return (
      q.title === event.title &&
      (q.source || "youtube").toLowerCase() === (event.source || "youtube").toLowerCase()
    );
  });

  if (existingIdx >= 0) {
    // Update watch duration if higher
    if ((event.watchedSeconds || 0) > (queue[existingIdx].watchedSeconds || 0)) {
      queue[existingIdx] = event;
    }
  } else {
    queue.push(event);
  }

  await chrome.storage.local.set({ watchQueue: queue });
  console.log(`[Drifter Sync] [${event.source || "youtube"}] Event queued (${queue.length} in queue).`);

  // Auto flush immediately so the dashboard stays live
  flushQueueToBackend();
}

async function flushQueueToBackend() {
  if (isFlushing) {
    return { success: false, inFlight: true, message: "Sync already in progress" };
  }
  isFlushing = true;

  try {
    const data = await getStorageData();
    const queue = data.watchQueue;

    if (queue.length === 0) {
      return { success: true, count: 0, message: "Queue is empty" };
    }

    const backendUrl = data.backendUrl.replace(/\/$/, "");
    const syncToken = data.syncToken;

    if (!syncToken) {
      console.warn("[Drifter Sync] Sync skipped: No sync token configured.");
      await chrome.storage.local.set({
        lastSyncStatus: "FAILED",
        lastSyncError: "No sync token configured. Open extension settings and paste your Drifter token.",
      });
      return {
        success: false,
        error: "No sync token configured. Please paste your token from the Drifter dashboard into extension settings.",
      };
    }

    const endpoint = `${backendUrl}/api/youtube-history`;

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${syncToken}`,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ events: queue }),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 401) {
        throw new Error("Invalid or expired sync token. Please re-copy your token from Drifter dashboard.");
      }
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const result = await response.json();
    console.log("[Drifter Sync] Sync successful:", result);

    // Atomically retain any events queued while the network request was in flight
    const currentData = await getStorageData();
    const remainingQueue = currentData.watchQueue.slice(queue.length);

    const now = new Date().toISOString();
    await chrome.storage.local.set({
      watchQueue: remainingQueue,
      lastSyncTime: now,
      lastSyncStatus: "SUCCESS",
      lastSyncError: null,
    });

    return {
      success: true,
      imported: result.imported,
      duplicates: result.duplicates,
      count: queue.length,
    };
  } catch (error) {
    console.error("[Drifter Sync] Sync failed:", error);
    const now = new Date().toISOString();
    await chrome.storage.local.set({
      lastSyncStatus: "FAILED",
      lastSyncError: error.message,
    });
    return { success: false, error: error.message };
  } finally {
    isFlushing = false;
  }
}
