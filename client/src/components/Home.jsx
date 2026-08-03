import { useState } from "react";
import { socket } from "../socket";
import { useServerStore } from "../store/useServerStore";

const API_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";

export default function Home({ onEnterServer }) {
  const [serverName, setServerName] = useState("");
  const [createUsername, setCreateUsername] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinUsername, setJoinUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setServerCode = useServerStore((s) => s.setServerCode);
  const setUsernameStore = useServerStore((s) => s.setUsername);

  async function handleCreateServer() {
    if (!serverName.trim()) {
      setError("Give your server a name first.");
      return;
    }
    if (!createUsername.trim()) {
      setError("Pick a username first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: serverName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create server");
      const server = await res.json();
      enterServer(server.code, createUsername.trim());
    } catch (err) {
      setError("Could not create server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinServer() {
    if (!joinCode.trim()) {
      setError("Enter a server code first.");
      return;
    }
    if (!joinUsername.trim()) {
      setError("Pick a username first.");
      return;
    }
    setLoading(true);
    setError("");
    const code = joinCode.trim().toUpperCase();
    try {
      const res = await fetch(`${API_URL}/servers/${code}`);
      if (!res.ok) throw new Error("Server not found");
      enterServer(code, joinUsername.trim());
    } catch (err) {
      setError("Server not found. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  }

  function enterServer(code, username) {
    setServerCode(code);
    setUsernameStore(username);
    if (!socket.connected) socket.connect();
    socket.emit("join-server", { code, username });
    onEnterServer();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDEAE1] text-[#3A2E2A] px-4">
      <div className="w-full max-w-sm p-8 bg-white rounded-3xl shadow-lg shadow-orange-100/50">
        <h1 className="text-3xl font-bold mb-2 text-center text-[#FF6B4A]">Sonder</h1>
        <p className="text-[#8A7A72] text-center mb-6 text-sm">
          Real-time community servers.
        </p>

        {/* Create a server */}
        <div className="mb-6">
          <p className="text-xs font-medium text-[#8A7A72] uppercase tracking-wide mb-2">
            Create a server
          </p>
          <input
            type="text"
            placeholder="Server name"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            className="w-full bg-[#FDEAE1] rounded-xl px-4 py-3 mb-2 outline-none focus:ring-2 focus:ring-[#FF6B4A] placeholder:text-[#B39A8F]"
          />
          <input
            type="text"
            placeholder="Pick a username"
            value={createUsername}
            onChange={(e) => setCreateUsername(e.target.value)}
            maxLength={20}
            className="w-full bg-[#FDEAE1] rounded-xl px-4 py-3 mb-3 outline-none focus:ring-2 focus:ring-[#FF6B4A] placeholder:text-[#B39A8F]"
          />
          <button
            onClick={handleCreateServer}
            disabled={loading}
            className="w-full bg-[#FF6B4A] hover:bg-[#FF5733] text-white transition rounded-xl py-3 font-medium disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Server"}
          </button>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <div className="flex-1 h-px bg-[#F0DCD1]" />
          <span className="text-[#B39A8F] text-sm">or</span>
          <div className="flex-1 h-px bg-[#F0DCD1]" />
        </div>

        {/* Join a server */}
        <div>
          <p className="text-xs font-medium text-[#8A7A72] uppercase tracking-wide mb-2">
            Join a server
          </p>
          <input
            type="text"
            placeholder="Enter server code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="w-full bg-[#FDEAE1] rounded-xl px-4 py-3 mb-2 outline-none focus:ring-2 focus:ring-[#FF6B4A] placeholder:text-[#B39A8F]"
          />
          <input
            type="text"
            placeholder="Pick a username"
            value={joinUsername}
            onChange={(e) => setJoinUsername(e.target.value)}
            maxLength={20}
            className="w-full bg-[#FDEAE1] rounded-xl px-4 py-3 mb-3 outline-none focus:ring-2 focus:ring-[#FF6B4A] placeholder:text-[#B39A8F]"
          />
          <button
            onClick={handleJoinServer}
            disabled={loading}
            className="w-full bg-white border-2 border-[#FF6B4A] text-[#FF6B4A] hover:bg-[#FFF3EE] transition rounded-xl py-3 font-medium disabled:opacity-50"
          >
            {loading ? "Joining..." : "Join Server"}
          </button>
        </div>

        {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
      </div>
    </div>
  );
}
