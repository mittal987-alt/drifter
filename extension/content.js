// content.js - YouTube Real-time Watch Tracker
(function () {
  let currentVideoId = null;
  let accumWatchTime = 0;
  let lastTimestamp = 0;
  let isLoggedForCurrentVideo = false;
  let videoElement = null;

  function getVideoId() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("v");
    } catch (e) {
      return null;
    }
  }

  function getVideoMetadata() {
    const videoId = getVideoId();
    let title = "";
    let channel = "";

    // YouTube DOM Selectors
    const titleEl = document.querySelector(
      "h1.ytd-watch-metadata yt-formatted-string, #title h1, h1.title"
    );
    if (titleEl) {
      title = titleEl.textContent.trim();
    }
    if (!title && document.title) {
      title = document.title.replace("- YouTube", "").trim();
    }

    const channelEl = document.querySelector(
      "ytd-channel-name #text, #owner-name #text, .ytd-channel-name a"
    );
    if (channelEl) {
      channel = channelEl.textContent.trim();
    }

    return {
      videoId: videoId || "",
      title: title || "YouTube Video",
      channel: channel || "YouTube Channel",
      url: window.location.href,
    };
  }

  function resetTracker() {
    const newVideoId = getVideoId();
    if (newVideoId !== currentVideoId) {
      currentVideoId = newVideoId;
      accumWatchTime = 0;
      lastTimestamp = 0;
      isLoggedForCurrentVideo = false;
    }
  }

  function checkWatchThreshold(durationSeconds) {
    if (isLoggedForCurrentVideo || !currentVideoId) return;

    // Threshold: 20 seconds OR 10% of video duration (min 5s)
    const minThreshold = durationSeconds
      ? Math.min(20, Math.max(5, durationSeconds * 0.1))
      : 20;

    if (accumWatchTime >= minThreshold) {
      isLoggedForCurrentVideo = true;
      const meta = getVideoMetadata();

      const watchEvent = {
        videoId: currentVideoId,
        title: meta.title,
        channel: meta.channel,
        url: meta.url,
        watchedSeconds: Math.round(accumWatchTime),
        durationSeconds: Math.round(durationSeconds || 0),
        watchedAt: new Date().toISOString(),
      };

      console.log("[Drifter Sync] Threshold met, logging watch event:", watchEvent);

      try {
        chrome.runtime.sendMessage({
          type: "YOUTUBE_WATCH_EVENT",
          payload: watchEvent,
        });
      } catch (err) {
        console.warn("[Drifter Sync] Could not send message to background worker:", err);
      }
    }
  }

  function attachVideoListeners() {
    const video = document.querySelector("video");
    if (!video || video === videoElement) return;

    videoElement = video;
    lastTimestamp = video.currentTime;

    video.addEventListener("timeupdate", () => {
      resetTracker();

      if (!video.paused && !video.ended && video.readyState >= 2) {
        const now = video.currentTime;
        const delta = now - lastTimestamp;

        // Ignore seek jumps (> 3s jump)
        if (delta > 0 && delta < 3) {
          accumWatchTime += delta;
          checkWatchThreshold(video.duration);
        }
        lastTimestamp = now;
      }
    });

    video.addEventListener("seeking", () => {
      lastTimestamp = video.currentTime;
    });

    video.addEventListener("play", () => {
      lastTimestamp = video.currentTime;
    });
  }

  // Observe SPA page navigation on YouTube (yt-navigate-finish)
  window.addEventListener("yt-navigate-finish", () => {
    resetTracker();
    setTimeout(attachVideoListeners, 1000);
  });

  // Initial setup and polling for dynamic video element
  resetTracker();
  attachVideoListeners();

  const observer = new MutationObserver(() => {
    attachVideoListeners();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
