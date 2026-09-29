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

  /* ==========================================================================
     5. SPOTIFY WEB PLAYER TRACKER
     ========================================================================== */
  else if (host.includes("spotify.com")) {
    let lastLoggedTrack = null;

    function checkSpotifyPlay() {
      const titleEl = document.querySelector(
        '[data-testid="now-playing-widget"] [data-testid="context-item-info-title"] a, [data-testid="context-item-info-title"] a, .Root__now-playing-bar [data-testid="context-item-info-title"]'
      );
      const artistEl = document.querySelector(
        '[data-testid="now-playing-widget"] [data-testid="context-item-info-artist"] a, [data-testid="context-item-info-artist"] a, .Root__now-playing-bar [data-testid="context-item-info-artist"]'
      );

      let title = titleEl?.textContent?.trim();
      let artist = artistEl?.textContent?.trim();

      if (!title && document.title.includes("•")) {
        const parts = document.title.split("•");
        title = parts[0]?.trim();
        artist = parts[1]?.trim();
      }

      if (title && title !== "Spotify" && title !== lastLoggedTrack) {
        const playPauseBtn = document.querySelector(
          '[data-testid="control-button-playpause"]'
        );
        const isPlaying =
          playPauseBtn?.getAttribute("aria-label")?.toLowerCase().includes("pause") ||
          playPauseBtn?.getAttribute("title")?.toLowerCase().includes("pause") ||
          document.title.includes("•");

        if (isPlaying) {
          lastLoggedTrack = title;
          const trackUrl = titleEl?.href || window.location.href;
          const spotifyEvent = {
            title: title,
            artist: artist || "Spotify Artist",
            url: trackUrl,
            source: "spotify",
            watchedSeconds: 30,
            watchedAt: new Date().toISOString(),
          };

          console.log("[Drifter Sync] Logging Spotify Web Player event:", spotifyEvent);
          chrome.runtime.sendMessage({
            type: "YOUTUBE_WATCH_EVENT",
            payload: spotifyEvent,
          });
        }
      }
    }

    setInterval(checkSpotifyPlay, 5000);
  }

  /* ==========================================================================
     6. STEAM STORE & COMMUNITY TRACKER
     ========================================================================== */
  else if (host.includes("steampowered.com") || host.includes("steamcommunity.com")) {
    const isApp = window.location.pathname.startsWith("/app/");
    if (isApp) {
      setTimeout(() => {
        let gameName = document.querySelector(".apphub_AppName, #appHubAppName")?.textContent?.trim();
        if (!gameName) {
          gameName = document.title.replace("on Steam", "").replace(/Save \d+%.*/, "").trim();
        }

        const steamEvent = {
          title: gameName || "Steam Game",
          artist: "Steam Store",
          url: window.location.href,
          source: "steam",
          watchedSeconds: 20,
          watchedAt: new Date().toISOString(),
        };

        console.log("[Drifter Sync] Logging Steam event:", steamEvent);
        chrome.runtime.sendMessage({
          type: "YOUTUBE_WATCH_EVENT",
          payload: steamEvent,
        });
      }, 8000);
    }
  }

  /* ==========================================================================
     7. TWITTER / X TRACKER
     ========================================================================== */
  else if (host.includes("twitter.com") || host.includes("x.com")) {
    let lastLoggedTweet = null;

    function checkTwitterTweet() {
      if (window.location.pathname.includes("/status/")) {
        const tweetId = window.location.pathname.split("/status/")[1]?.split(/[?&#/]/)[0];
        if (tweetId && tweetId !== lastLoggedTweet) {
          setTimeout(() => {
            const tweetTextEl = document.querySelector('article[data-testid="tweet"] [data-testid="tweetText"]');
            const tweetText = tweetTextEl?.textContent?.trim() || "";
            const authorEl = document.querySelector('article[data-testid="tweet"] [data-testid="User-Name"]');
            const authorText = authorEl?.textContent?.replace(/\s+/g, " ")?.trim() || "X User";

            if (tweetText && tweetId !== lastLoggedTweet) {
              lastLoggedTweet = tweetId;
              const handleMatch = authorText.match(/@(\w+)/);
              const authorHandle = handleMatch ? `@${handleMatch[1]}` : authorText.slice(0, 25);

              const twitterEvent = {
                title: tweetText.slice(0, 160),
                artist: authorHandle,
                url: window.location.href,
                source: "twitter",
                watchedSeconds: 15,
                watchedAt: new Date().toISOString(),
              };

              console.log("[Drifter Sync] Logging Twitter/X event:", twitterEvent);
              chrome.runtime.sendMessage({
                type: "YOUTUBE_WATCH_EVENT",
                payload: twitterEvent,
              });
            }
          }, 6000);
        }
      }
    }

    setInterval(checkTwitterTweet, 4000);
  }

  /* ==========================================================================
     8. GENERAL WEB BROWSING (360° Curiosity Engine)
     ========================================================================== */
  else {
    const isInternal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      host.includes("accounts.google.com");

    const pathname = window.location.pathname.toLowerCase();
    const isAuth =
      pathname.includes("/login") ||
      pathname.includes("/signin") ||
      pathname.includes("/signup") ||
      pathname.includes("/oauth");

    if (!isInternal && !isAuth && document.title) {
      let logged = false;
      const dwellTimer = setTimeout(() => {
        if (logged || document.hidden) return;

        const rawTitle = document.title.trim();
        if (rawTitle.length < 4 || rawTitle.toLowerCase() === "loading...") return;

        const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || "";
        const cleanHost = host.replace(/^www\./, "");

        const browserEvent = {
          title: rawTitle + (metaDesc ? ` - ${metaDesc.slice(0, 100)}` : ""),
          artist: cleanHost,
          url: window.location.href,
          source: "browser",
          watchedSeconds: 25,
          watchedAt: new Date().toISOString(),
        };

        logged = true;
        console.log("[Drifter Sync] Logging Web Browsing trace:", browserEvent);
        chrome.runtime.sendMessage({
          type: "YOUTUBE_WATCH_EVENT",
          payload: browserEvent,
        });
      }, 15000);

      window.addEventListener("beforeunload", () => clearTimeout(dwellTimer));
    }
  }
})();

