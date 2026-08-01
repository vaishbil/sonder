import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { useRoomStore } from "../store/useRoomStore";
import TrackPicker from "./TrackPicker";
import YoutubePicker from "./YoutubePicker";
import YoutubePlayer from "./YoutubePlayer";

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function Room({ onLeaveRoom }) {
  const {
    roomCode,
    isHost,
    setIsHost,
    currentTrack,
    setCurrentTrack,
    playbackState,
    setPlaybackState,
    messages,
    addMessage,
    reset,
  } = useRoomStore();

  const audioElRef = useRef(null);
  const youtubeRef = useRef(null);
  const chatInputRef = useRef(null);
  const [displayTime, setDisplayTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [pickerMode, setPickerMode] = useState("youtube");

  const isYoutube = currentTrack?.sourceType === "youtube";
  const hasTrack = Boolean(currentTrack?.title || currentTrack?.youtubeVideoId);

  function getPlayer() {
    return isYoutube ? youtubeRef.current : audioElRef.current;
  }

  useEffect(() => {
    socket.on("room-state", ({ playbackState: state, isHost: hostFlag, currentTrack: track }) => {
      setIsHost(hostFlag);
      setPlaybackState(state);
      if (track) setCurrentTrack(track);
    });

    socket.on("track-changed", (track) => {
      setCurrentTrack(track);
      setDisplayTime(0);
      if (track.sourceType !== "youtube" && audioElRef.current) {
        audioElRef.current.src = track.audioUrl || "";
        audioElRef.current.load();
      }
    });

    socket.on("sync-playback", ({ type, positionSeconds }) => {
      const player = getPlayer();
      if (player) {
        // Avoid jarring re-seeks for tiny drift on periodic resyncs
        const drift = Math.abs((player.currentTime || 0) - positionSeconds);
        if (type !== "seek" || drift > 1) {
          player.currentTime = positionSeconds;
        }
        if (type === "play") player.play();
        if (type === "pause") player.pause();
      }
      if (type !== "seek") {
        setPlaybackState({ isPlaying: type === "play", positionSeconds });
      }
    });

    socket.on("host-changed", ({ newHostSocketId }) => {
      setIsHost(newHostSocketId === socket.id);
    });

    socket.on("chat-message", (msg) => addMessage(msg));
    socket.on("error-message", (msg) => alert(msg));

    return () => {
      socket.off("room-state");
      socket.off("track-changed");
      socket.off("sync-playback");
      socket.off("host-changed");
      socket.off("chat-message");
      socket.off("error-message");
    };
  }, [currentTrack]);

  // Audio element progress (YouTube reports via its own callback)
  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio || isYoutube) return;

    function handleTimeUpdate() {
      if (!isSeeking) setDisplayTime(audio.currentTime);
    }
    function handleLoadedMetadata() {
      setDuration(audio.duration);
    }

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [isSeeking, currentTrack, isYoutube]);

  // Periodic resync while the host is playing a YouTube video, to correct drift
  useEffect(() => {
    if (!isHost || !isYoutube || !playbackState.isPlaying) return;
    const interval = setInterval(() => {
      const player = getPlayer();
      if (player) {
        emitPlayback("seek", player.currentTime);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isHost, isYoutube, playbackState.isPlaying]);

  function emitPlayback(type, positionSeconds) {
    socket.emit("playback-event", { code: roomCode, type, positionSeconds });
    if (type !== "seek") {
      setPlaybackState({ isPlaying: type === "play", positionSeconds });
    }
  }

  // Native YouTube controls (host only) drive sync through this callback
  function handleYoutubeHostStateChange(type, positionSeconds) {
    emitPlayback(type, positionSeconds);
  }

  function handlePlay() {
    const player = getPlayer();
    player?.play();
    emitPlayback("play", player?.currentTime || 0);
  }

  function handlePause() {
    const player = getPlayer();
    player?.pause();
    emitPlayback("pause", player?.currentTime || 0);
  }

  function handleSeekInput(e) {
    setIsSeeking(true);
    setDisplayTime(Number(e.target.value));
  }

  function handleSeekCommit(e) {
    const newTime = Number(e.target.value);
    const player = getPlayer();
    if (player) player.currentTime = newTime;
    setIsSeeking(false);
    emitPlayback("seek", newTime);
  }

  function handleRemoveTrack() {
    socket.emit("clear-track", { code: roomCode });
  }

  function handleSendMessage(e) {
    e.preventDefault();
    const text = chatInputRef.current.value.trim();
    if (!text) return;
    socket.emit("chat-message", { code: roomCode, text, sender: socket.id.slice(0, 5) });
    chatInputRef.current.value = "";
  }

  function handleLeave() {
    socket.disconnect();
    reset();
    onLeaveRoom();
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Room {roomCode}</h2>
            <p className="text-sm text-gray-400">
              {isHost ? "You're the host" : "Watching in sync"}
            </p>
          </div>
          <button onClick={handleLeave} className="text-sm text-gray-400 hover:text-white">
            Leave
          </button>
        </div>

        {isHost && (
          <div className="mb-2 flex gap-2 text-xs">
            <button
              onClick={() => setPickerMode("youtube")}
              className={`px-3 py-1 rounded-full ${pickerMode === "youtube" ? "bg-indigo-600" : "bg-gray-700"}`}
            >
              YouTube
            </button>
            <button
              onClick={() => setPickerMode("audio")}
              className={`px-3 py-1 rounded-full ${pickerMode === "audio" ? "bg-indigo-600" : "bg-gray-700"}`}
            >
              Music search
            </button>
          </div>
        )}

        {isHost && (pickerMode === "youtube" ? <YoutubePicker /> : <TrackPicker />)}

        {hasTrack ? (
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-300">
              {isYoutube ? "Now watching" : "Now playing"}:{" "}
              <span className="font-medium">{currentTrack.title}</span>
              {currentTrack.artist && <span className="text-gray-500"> — {currentTrack.artist}</span>}
            </p>
            {isHost && (
              <button
                onClick={handleRemoveTrack}
                className="text-xs text-gray-400 hover:text-red-400 ml-2 shrink-0"
                title="Remove video"
              >
                ✕ Remove
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-3">
            {isHost ? "Paste a YouTube link or search a track above." : "Waiting for the host to pick something..."}
          </p>
        )}

        {isYoutube && (
          <YoutubePlayer
            key={currentTrack.youtubeVideoId}
            ref={youtubeRef}
            videoId={currentTrack.youtubeVideoId}
            isHost={isHost}
            onHostStateChange={handleYoutubeHostStateChange}
            initialPositionSeconds={playbackState.positionSeconds}
            initialIsPlaying={playbackState.isPlaying}
          />
        )}

        {!isYoutube && <audio ref={audioElRef} src={currentTrack?.audioUrl || ""} className="hidden" />}

        {/* Custom play/pause + seek bar only shown for audio tracks — YouTube uses its own native controls */}
        {!isYoutube && (
          <>
            <div className="mb-4">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={displayTime}
                onChange={isHost ? handleSeekInput : undefined}
                onMouseUp={isHost ? handleSeekCommit : undefined}
                onTouchEnd={isHost ? handleSeekCommit : undefined}
                disabled={!isHost || !hasTrack}
                className="w-full accent-indigo-500 disabled:opacity-40"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{formatTime(displayTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex gap-3 mb-8">
              <button
                onClick={handlePlay}
                disabled={!isHost}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg py-3 font-medium disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Play
              </button>
              <button
                onClick={handlePause}
                disabled={!isHost}
                className="flex-1 bg-gray-700 hover:bg-gray-600 rounded-lg py-3 font-medium disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Pause
              </button>
            </div>
          </>
        )}

        {!isHost && (
          <p className="text-xs text-gray-500 mb-6 text-center">
            Only the host can control playback — you'll stay in sync automatically.
          </p>
        )}

        <div className="bg-gray-800 rounded-xl p-4 h-64 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-2 mb-2">
            {messages.map((m, i) => (
              <div key={i} className="text-sm">
                <span className="text-indigo-400 font-medium">{m.sender}: </span>
                <span className="text-gray-200">{m.text}</span>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              ref={chatInputRef}
              type="text"
              placeholder="Say something..."
              className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 rounded-lg px-4 py-2 text-sm">
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
