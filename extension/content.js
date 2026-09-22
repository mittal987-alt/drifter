// content.js - YouTube Real-time Watch Tracker
(function () {
  let currentVideoId = null;
  let accumWatchTime = 0;
  let lastTimestamp = 0;
  let isLoggedForCurrentVideo = false;
  let videoElement = null;

  function getVideoId() {
    try {
      if (window.location.pathname.startsWith("/shorts/")) {
        const parts = window.location.pathname.split("/shorts/")[1];
        return parts ? parts.split(/[?&#/]/)[0] : null;
      }
      if (window.location.pathname.startsWith("/live/")) {
        const parts = window.location.pathname.split("/live/")[1];
        return parts ? parts.split(/[?&#/]/)[0] : null;
      }
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

    // Comprehensive YouTube DOM Selectors (Standard, Shorts, Redesigns)
    const titleEl = document.querySelector(
      "h1.ytd-watch-metadata yt-formatted-string, #title h1, h1.title, .ytd-video-primary-info-renderer h1, yt-formatted-string.ytd-watch-metadata, #container > h1 > yt-formatted-string, ytd-reel-player-header-renderer .title, h2.reel-player-header-title, yt-formatted-string.ytd-reel-player-header-renderer"
    );
    if (titleEl) {
      title = titleEl.textContent.trim();
    }
    if (!title && document.title) {
      title = document.title.replace("- YouTube", "").replace(/^\(\d+\)\s*/, "").trim();
    }

    const channelEl = document.querySelector(
      "ytd-watch-metadata #channel-name #text, ytd-channel-name #text, #owner-name #text, .ytd-channel-name a, #channel-name yt-formatted-string, ytd-reel-channel-bar-renderer #channel-name yt-formatted-string"
    );
    if (channelEl) {
      channel = channelEl.textContent.trim();
    }

    return {
      videoId: videoId || "",
      title: title || (videoId ? `YouTube Video (${videoId})` : "YouTube Video"),
      channel: channel || "YouTube",
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

    const dur = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : null;
    // Threshold: 15 seconds OR 10% of video duration (min 5s, max 15s)
    const minThreshold = dur
      ? Math.min(15, Math.max(5, dur * 0.1))
      : 10;

    if (accumWatchTime >= minThreshold) {
      isLoggedForCurrentVideo = true;
      const meta = getVideoMetadata();

      const watchEvent = {
        videoId: currentVideoId,
        title: meta.title,
        channel: meta.channel,
        url: meta.url,
        watchedSeconds: Math.round(accumWatchTime),
        durationSeconds: Math.round(dur || 0),
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

  // Observe SPA page navigation on YouTube
  window.addEventListener("yt-navigate-finish", () => {
    resetTracker();
    setTimeout(attachVideoListeners, 500);
  });
  window.addEventListener("yt-page-data-updated", () => {
    resetTracker();
    setTimeout(attachVideoListeners, 500);
  });
  window.addEventListener("popstate", () => {
    resetTracker();
    setTimeout(attachVideoListeners, 500);
  });

  // Initial setup and polling for dynamic video element
  resetTracker();
  attachVideoListeners();

  const observer = new MutationObserver(() => {
    attachVideoListeners();
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
