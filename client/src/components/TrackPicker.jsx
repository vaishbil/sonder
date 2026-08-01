import { useState } from "react";
import { socket } from "../socket";
import { useRoomStore } from "../store/useRoomStore";

const API_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";

export default function TrackPicker() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const roomCode = useRoomStore((s) => s.roomCode);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/tracks/search?q=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error("Track search failed:", err);
    } finally {
      setLoading(false);
    }
  }

  function selectTrack(track) {
    socket.emit("change-track", {
      code: roomCode,
      trackId: track.trackId,
      title: track.title,
      artist: track.artist,
      audioUrl: track.audioUrl,
      sourceType: "audio",
      youtubeVideoId: null,
    });
    setResults([]);
    setQuery("");
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 mb-6">
      <form onSubmit={handleSearch} className="flex gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Jamendo for a track..."
          className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "..." : "Search"}
        </button>
      </form>

      {results.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {results.map((track) => (
            <button
              key={track.trackId}
              onClick={() => selectTrack(track)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-700 transition flex justify-between items-center text-sm"
            >
              <span>
                <span className="font-medium">{track.title}</span>
                <span className="text-gray-400"> — {track.artist}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
