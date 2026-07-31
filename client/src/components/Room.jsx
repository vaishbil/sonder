import { useEffect, useRef } from "react";
import { socket } from "../socket";
import { useRoomStore } from "../store/useRoomStore";
import TrackPicker from "./TrackPicker";

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

  const audioRef = useRef(null);
  const chatInputRef = useRef(null);

  useEffect(() => {
    // Initial state when we first join
    socket.on("room-state", ({ playbackState: state, isHost: hostFlag, currentTrack: track }) => {
      setIsHost(hostFlag);
      setPlaybackState(state);
      if (track) setCurrentTrack(track);
    });

    // Track changed by host
    socket.on("track-changed", (track) => {
      setCurrentTrack(track);
      if (audioRef.current) {
        audioRef.current.src = track.audioUrl;
        audioRef.current.load();
      }
    });

    // Another client (non-host) receives sync updates from host
    socket.on("sync-playback", ({ type, positionSeconds }) => {
      setPlaybackState({
        isPlaying: type === "play",
        positionSeconds,
      });
      if (audioRef.current) {
        audioRef.current.currentTime = positionSeconds;
        if (type === "play") audioRef.current.play();
        if (type === "pause") audioRef.current.pause();
      }
    });

    socket.on("host-changed", ({ newHostSocketId }) => {
      setIsHost(newHostSocketId === socket.id);
    });

    socket.on("chat-message", (msg) => {
      addMessage(msg);
    });

    socket.on("error-message", (msg) => {
      alert(msg);
    });

    return () => {
      socket.off("room-state");
      socket.off("track-changed");
      socket.off("sync-playback");
      socket.off("host-changed");
      socket.off("chat-message");
      socket.off("error-message");
    };
  }, []);

  function emitPlayback(type) {
    if (!isHost || !audioRef.current) return;
    const positionSeconds = audioRef.current.currentTime;
    socket.emit("playback-event", { code: roomCode, type, positionSeconds });
    setPlaybackState({ isPlaying: type === "play", positionSeconds });
  }

  function handlePlay() {
    audioRef.current?.play();
    emitPlayback("play");
  }

  function handlePause() {
    audioRef.current?.pause();
    emitPlayback("pause");
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
              {isHost ? "You're the host" : "Listening in sync"}
            </p>
          </div>
          <button
            onClick={handleLeave}
            className="text-sm text-gray-400 hover:text-white"
          >
            Leave
          </button>
        </div>

        {isHost && <TrackPicker />}

        {currentTrack?.title ? (
          <p className="text-sm text-gray-300 mb-3">
            Now playing: <span className="font-medium">{currentTrack.title}</span>
            {currentTrack.artist && (
              <span className="text-gray-500"> — {currentTrack.artist}</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-gray-500 mb-3">
            {isHost ? "Search and pick a track above to get started." : "Waiting for the host to pick a track..."}
          </p>
        )}

        <audio ref={audioRef} src={currentTrack?.audioUrl || ""} className="w-full mb-4" />

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
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 rounded-lg px-4 py-2 text-sm"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
