// content.js - Multi-Platform Real-time Attention & Watch Tracker
(function () {
  const host = window.location.hostname.toLowerCase();

  /* ==========================================================================
     1. YOUTUBE TRACKER
     ========================================================================== */
  if (host.includes("youtube.com")) {
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

      const titleEl = document.querySelector(
        "h1.ytd-watch-metadata yt-formatted-string, #title h1, h1.title, .ytd-video-primary-info-renderer h1, yt-formatted-string.ytd-watch-metadata, #container > h1 > yt-formatted-string, ytd-reel-player-header-renderer .title, h2.reel-player-header-title, yt-formatted-string.ytd-reel-player-header-renderer"
      );
      if (titleEl) title = titleEl.textContent.trim();
      if (!title && document.title) {
        title = document.title.replace("- YouTube", "").replace(/^\(\d+\)\s*/, "").trim();
      }

      const channelEl = document.querySelector(
        "ytd-watch-metadata #channel-name #text, ytd-channel-name #text, #owner-name #text, .ytd-channel-name a, #channel-name yt-formatted-string, ytd-reel-channel-bar-renderer #channel-name yt-formatted-string"
      );
      if (channelEl) channel = channelEl.textContent.trim();

      return {
        videoId: videoId || "",
        title: title || (videoId ? `YouTube Video (${videoId})` : "YouTube Video"),
        channel: channel || "YouTube",
        url: window.location.href,
        source: "youtube",
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
      const minThreshold = dur ? Math.min(15, Math.max(5, dur * 0.1)) : 10;

      if (accumWatchTime >= minThreshold) {
        isLoggedForCurrentVideo = true;
        const meta = getVideoMetadata();

        const watchEvent = {
          videoId: currentVideoId,
          title: meta.title,
          channel: meta.channel,
          url: meta.url,
          source: "youtube",
          watchedSeconds: Math.round(accumWatchTime),
          durationSeconds: Math.round(dur || 0),
          watchedAt: new Date().toISOString(),
        };

        console.log("[Drifter Sync] Logging YouTube event:", watchEvent);
        chrome.runtime.sendMessage({
          type: "YOUTUBE_WATCH_EVENT",
          payload: watchEvent,
        });
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
          if (delta > 0 && delta < 3) {
            accumWatchTime += delta;
            checkWatchThreshold(video.duration);
          }
          lastTimestamp = now;
        }
      });
    }

    window.addEventListener("yt-navigate-finish", () => {
      resetTracker();
      setTimeout(attachVideoListeners, 500);
    });
    window.addEventListener("popstate", () => {
      resetTracker();
      setTimeout(attachVideoListeners, 500);
    });

    resetTracker();
    attachVideoListeners();
    const observer = new MutationObserver(attachVideoListeners);
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ==========================================================================
     2. NETFLIX TRACKER
     ========================================================================== */
  else if (host.includes("netflix.com")) {
    let isNetflixLogged = false;
    let watchTimer = null;

    function checkNetflixWatch() {
      if (!window.location.pathname.startsWith("/watch/")) return;
      if (isNetflixLogged) return;

      const video = document.querySelector("video");
      if (video && !video.paused) {
        if (!watchTimer) {
          watchTimer = setTimeout(() => {
            isNetflixLogged = true;
            let title = document.querySelector(".video-title h4, [data-uia='video-title']")?.textContent?.trim();
            if (!title) title = document.title.replace("- Netflix", "").trim();

            const netflixEvent = {
              title: title || "Netflix Title",
              url: window.location.href,
              source: "netflix",
              watchedSeconds: 30,
              watchedAt: new Date().toISOString(),
            };

            console.log("[Drifter Sync] Logging Netflix event:", netflixEvent);
            chrome.runtime.sendMessage({
              type: "YOUTUBE_WATCH_EVENT",
              payload: netflixEvent,
            });
          }, 15000); // Log after 15s of active streaming
        }
      }
    }

    setInterval(checkNetflixWatch, 3000);
  }

  /* ==========================================================================
     3. GITHUB REPOSITORY / RESEARCH TRACKER
     ========================================================================== */
  else if (host.includes("github.com")) {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && !["settings", "notifications", "explore", "trending"].includes(parts[0])) {
      const repoName = `${parts[0]}/${parts[1]}`;
      setTimeout(() => {
        const desc = document.querySelector("p.f4, [itemprop='about']")?.textContent?.trim() || "";
        const githubEvent = {
          title: `${repoName}${desc ? ` - ${desc}` : ""}`,
          url: window.location.href,
          source: "github",
          watchedSeconds: 20,
          watchedAt: new Date().toISOString(),
        };

        console.log("[Drifter Sync] Logging GitHub event:", githubEvent);
        chrome.runtime.sendMessage({
          type: "YOUTUBE_WATCH_EVENT",
          payload: githubEvent,
        });
      }, 10000); // Log after 10s of repo research
    }
  }

  /* ==========================================================================
     4. REDDIT DISCUSSION TRACKER
     ========================================================================== */
  else if (host.includes("reddit.com")) {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.includes("r") && parts.includes("comments")) {
      setTimeout(() => {
        let postTitle = document.querySelector("h1, [slot='title']")?.textContent?.trim();
        if (!postTitle) postTitle = document.title.replace("- Reddit", "").trim();

        const subreddit = parts[parts.indexOf("r") + 1] || "reddit";

        const redditEvent = {
          title: `r/${subreddit}: ${postTitle}`,
          channel: `r/${subreddit}`,
          url: window.location.href,
          source: "reddit",
          watchedSeconds: 15,
          watchedAt: new Date().toISOString(),
        };

        console.log("[Drifter Sync] Logging Reddit event:", redditEvent);
        chrome.runtime.sendMessage({
          type: "YOUTUBE_WATCH_EVENT",
          payload: redditEvent,
        });
      }, 10000); // Log after 10s of thread reading
    }
  }
})();
