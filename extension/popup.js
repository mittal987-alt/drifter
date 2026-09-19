// popup.js - Interactive UI Controller for Drifter Extension
document.addEventListener("DOMContentLoaded", () => {
  const backendUrlInput = document.getElementById("backendUrl");
  const syncTokenInput = document.getElementById("syncToken");
  const queueBadge = document.getElementById("queueBadge");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const saveBtn = document.getElementById("saveBtn");
  const syncBtn = document.getElementById("syncBtn");
  const messageBox = document.getElementById("messageBox");

  function loadState() {
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
        backendUrlInput.value = data.backendUrl || "http://127.0.0.1:8000";
        syncTokenInput.value = data.syncToken || "";

        const queue = data.watchQueue || [];
        queueBadge.textContent = `${queue.length} ${
          queue.length === 1 ? "event" : "events"
        }`;

        const status = data.lastSyncStatus || "IDLE";
        const lastTime = data.lastSyncTime
          ? new Date(data.lastSyncTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : null;

        statusDot.className = "dot";
        if (status === "SUCCESS") {
          statusDot.classList.add("success");
          statusText.textContent = lastTime ? `Synced at ${lastTime}` : "Success";
        } else if (status === "FAILED") {
          statusDot.classList.add("failed");
          statusText.textContent = "Sync Error";
          if (data.lastSyncError) {
            showMessage(data.lastSyncError, true);
          }
        } else {
          statusDot.classList.add("idle");
          statusText.textContent = "Idle";
        }
      }
    );
  }

  function showMessage(text, isError = false) {
    messageBox.textContent = text;
    messageBox.className = `message ${isError ? "error" : "success"}`;
    setTimeout(() => {
      if (messageBox.textContent === text) {
        messageBox.textContent = "";
      }
    }, 4000);
  }

  saveBtn.addEventListener("click", () => {
    const url = backendUrlInput.value.trim() || "http://127.0.0.1:8000";
    const token = syncTokenInput.value.trim();

    chrome.storage.local.set(
      { backendUrl: url, syncToken: token },
      () => {
        showMessage("Settings saved successfully!");
      }
    );
  });

  syncBtn.addEventListener("click", () => {
    syncBtn.disabled = true;
    syncBtn.textContent = "Syncing...";
    showMessage("Flushing watch queue to backend...");

    chrome.runtime.sendMessage({ type: "TRIGGER_SYNC_NOW" }, (response) => {
      syncBtn.disabled = false;
      syncBtn.textContent = "Sync Now";

      if (response && response.success) {
        showMessage(
          `Synced ${response.count || 0} events successfully!`
        );
      } else {
        showMessage(
          response?.error || "Sync failed. Check backend URL/token.",
          true
        );
      }
      loadState();
    });
  });

  loadState();
});
