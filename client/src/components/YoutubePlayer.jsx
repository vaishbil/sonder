import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

let ytApiPromise = null;
function loadYoutubeApi() {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
  });
  return ytApiPromise;
}

const YoutubePlayer = forwardRef(function YoutubePlayer(
  { videoId, isHost, onHostStateChange, initialPositionSeconds = 0, initialIsPlaying = false },
  ref
) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [hasJoined, setHasJoined] = useState(isHost);
  const [playerReady, setPlayerReady] = useState(false);
  const [embedError, setEmbedError] = useState(false);

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.playVideo(),
    pause: () => playerRef.current?.pauseVideo(),
    get currentTime() {
      return playerRef.current?.getCurrentTime?.() || 0;
    },
    set currentTime(val) {
      playerRef.current?.seekTo(val, true);
    },
    get duration() {
      return playerRef.current?.getDuration?.() || 0;
    },
  }));

  useEffect(() => {
    loadYoutubeApi().then((YT) => {
      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          controls: isHost ? 1 : 0,
          disablekb: isHost ? 0 : 1,
          modestbranding: 1,
          mute: isHost ? 0 : 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            setPlayerReady(true);
            // Land latecomers at the correct position instead of starting from 0
            if (initialPositionSeconds > 0) {
              playerRef.current.seekTo(initialPositionSeconds, true);
            }
            if (!isHost) {
              playerRef.current.mute();
              // Muted autoplay attempt — works in most browsers, but the
              // join button below is the guaranteed fallback either way
              if (initialIsPlaying) playerRef.current.playVideo();
            }
          },
          onStateChange: (event) => {
            if (!isHost) return;
            const time = playerRef.current.getCurrentTime();
            if (event.data === window.YT.PlayerState.PLAYING) {
              onHostStateChange?.("play", time);
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              onHostStateChange?.("pause", time);
            }
          },
          onError: (event) => {
            console.error("YouTube player error code:", event.data);
            // 2 = invalid video ID, 100 = video not found/private, 101/150 = embedding disabled
            setEmbedError(true);
          },
        },
      });
    });

    return () => {
      playerRef.current?.destroy?.();
    };
  }, [videoId]);

  // One real click that reliably unlocks audio + playback, regardless of
  // browser autoplay policy quirks around programmatic/muted playback
  function handleJoinSync() {
    console.log("Join sync clicked", playerRef.current);
    if (!playerRef.current) return;
    playerRef.current.unMute();
    playerRef.current.setVolume(100);
    playerRef.current.playVideo();
    setHasJoined(true);
  }

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black mb-4">
      <div ref={containerRef} className="w-full h-full" />
      {embedError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-4">
          <p className="text-sm text-gray-300 text-center">
            This video couldn't be loaded — it may be private, removed, or have embedding disabled by its owner. Try a different link.
          </p>
        </div>
      )}
      {!embedError && !isHost && playerReady && !hasJoined && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/60"
          style={{ zIndex: 50, pointerEvents: "auto" }}
        >
          <button
            onClick={handleJoinSync}
            style={{ zIndex: 51, pointerEvents: "auto" }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-5 py-3 rounded-lg shadow-lg font-medium"
          >
            ▶ Click to join with sound
          </button>
        </div>
      )}
    </div>
  );
});

export default YoutubePlayer;
