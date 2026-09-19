// background.js - Service Worker for YouTube History Sync
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
  if (message.type === "YOUTUBE_WATCH_EVENT") {
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

async function handleIncomingWatchEvent(event) {
  const data = await getStorageData();
  const queue = data.watchQueue;

  const todayStr = new Date(event.watchedAt).toISOString().split("T")[0];

  // Deduplicate same video ID watched on the same day
  const existingIdx = queue.findIndex((q) => {
    const qDate = new Date(q.watchedAt).toISOString().split("T")[0];
    return q.videoId === event.videoId && qDate === todayStr;
  });

  if (existingIdx >= 0) {
    // Update watch duration if higher
    if (event.watchedSeconds > queue[existingIdx].watchedSeconds) {
      queue[existingIdx] = event;
    }
  } else {
    queue.push(event);
  }

  await chrome.storage.local.set({ watchQueue: queue });
  console.log(`[Drifter Sync] Event queued (${queue.length} total in queue).`);

  // Auto flush if 5 or more events accumulated
  if (queue.length >= 5) {
    flushQueueToBackend();
  }
}

async function flushQueueToBackend() {
  const data = await getStorageData();
  const queue = data.watchQueue;

  if (queue.length === 0) {
    return { success: true, count: 0, message: "Queue is empty" };
  }

  const backendUrl = data.backendUrl.replace(/\/$/, "");
  const syncToken = data.syncToken;

  const endpoint = `${backendUrl}/api/youtube-history`;

  const headers = {
    "Content-Type": "application/json",
  };
  if (syncToken) {
    headers["Authorization"] = `Bearer ${syncToken}`;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ events: queue }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const result = await response.json();
    console.log("[Drifter Sync] Sync successful:", result);

    const now = new Date().toISOString();
    await chrome.storage.local.set({
      watchQueue: [],
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
  }
}
