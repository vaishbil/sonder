import { useState } from "react";
import { socket } from "../socket";
import { useRoomStore } from "../store/useRoomStore";
import { extractYoutubeId } from "../youtubeUtils";

export default function YoutubePicker() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const roomCode = useRoomStore((s) => s.roomCode);

  function handleSubmit(e) {
    e.preventDefault();
    const videoId = extractYoutubeId(url);

    if (!videoId) {
      setError("Couldn't find a video ID in that link. Paste a full YouTube URL.");
      return;
    }

    setError("");
    socket.emit("change-track", {
      code: roomCode,
      trackId: videoId,
      title: "YouTube video",
      artist: null,
      audioUrl: null,
      sourceType: "youtube",
      youtubeVideoId: videoId,
    });
    setUrl("");
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 mb-6">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube link..."
          className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 rounded-lg px-4 py-2 text-sm"
        >
          Load
        </button>
      </form>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
