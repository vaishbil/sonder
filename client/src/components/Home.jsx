import { useState } from "react";
import { socket } from "../socket";
import { useRoomStore } from "../store/useRoomStore";

const API_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";

export default function Home({ onEnterRoom }) {
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setRoomCode = useRoomStore((s) => s.setRoomCode);

  async function handleCreateRoom() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/rooms`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to create room");
      const room = await res.json();
      enterRoom(room.code);
    } catch (err) {
      setError("Could not create room. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinRoom() {
    if (!joinCode.trim()) return;
    setLoading(true);
    setError("");
    const code = joinCode.trim().toUpperCase();
    try {
      const res = await fetch(`${API_URL}/rooms/${code}`);
      if (!res.ok) throw new Error("Room not found");
      enterRoom(code);
    } catch (err) {
      setError("Room not found. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  }

  function enterRoom(code) {
    setRoomCode(code);
    if (!socket.connected) socket.connect();
    socket.emit("join-room", { code });
    onEnterRoom();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="w-full max-w-sm p-8 bg-gray-800 rounded-2xl shadow-xl">
        <h1 className="text-3xl font-bold mb-2 text-center">Sonder</h1>
        <p className="text-gray-400 text-center mb-6">
          Listen together, in sync.
        </p>

        <button
          onClick={handleCreateRoom}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 transition rounded-lg py-3 font-medium mb-4 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create a Room"}
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-px bg-gray-700" />
          <span className="text-gray-500 text-sm">or</span>
          <div className="flex-1 h-px bg-gray-700" />
        </div>

        <input
          type="text"
          placeholder="Enter room code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          className="w-full bg-gray-700 rounded-lg px-4 py-3 mb-3 outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={handleJoinRoom}
          disabled={loading}
          className="w-full bg-gray-700 hover:bg-gray-600 transition rounded-lg py-3 font-medium disabled:opacity-50"
        >
          {loading ? "Joining..." : "Join Room"}
        </button>

        {error && (
          <p className="text-red-400 text-sm mt-4 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
