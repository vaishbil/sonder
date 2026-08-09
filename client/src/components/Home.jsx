import { useState, useEffect } from "react";
import { socket } from "../socket";
import { useServerStore } from "../store/useServerStore";
import { getClientId } from "../clientId";

const API_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";

const FEATURE_STICKERS = [
  { label: "live chat", bg: "#FBE4D8", text: "#B5502A", rotate: "-3deg" },
  { label: "who's online", bg: "#DFF3EC", text: "#1D7A5C", rotate: "2deg" },
  { label: "drop a pic", bg: "#FCEFD6", text: "#A9750F", rotate: "-1deg" },
  { label: "@ mention", bg: "#EFE9FB", text: "#6A4FC2", rotate: "3deg" },
];

export default function Home({ onEnterServer }) {
  const rememberedName = localStorage.getItem("sonder_last_username") || "";
  const rememberedServerCode = localStorage.getItem("sonder_last_server_code") || "";

  const initialJoinCode = (() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("join")?.toUpperCase() || "";
  })();

  const shouldAutoRejoin = !initialJoinCode && !!rememberedServerCode && !!rememberedName;

  const [mode, setMode] = useState(initialJoinCode ? "join" : "create");
  const [serverName, setServerName] = useState("");
  const [createUsername, setCreateUsername] = useState(rememberedName);
  const [joinCode, setJoinCode] = useState(initialJoinCode || rememberedServerCode);
  const [joinUsername, setJoinUsername] = useState(rememberedName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [autoRejoining, setAutoRejoining] = useState(shouldAutoRejoin);
  const setServerCode = useServerStore((s) => s.setServerCode);
  const setUsernameStore = useServerStore((s) => s.setUsername);

  function enterServer(code, username) {
    setServerCode(code);
    setUsernameStore(username);
    localStorage.setItem("sonder_last_username", username);
    localStorage.setItem("sonder_last_server_code", code);
    if (!socket.connected) socket.connect();
    socket.emit("join-server", { code, username, clientId: getClientId() });
    window.history.replaceState({}, "", window.location.pathname);
    onEnterServer();
  }

  useEffect(() => {
    if (!shouldAutoRejoin) return;

    const tryAutoRejoin = async () => {
      try {
        const res = await fetch(`${API_URL}/servers/${rememberedServerCode}`);
        if (!res.ok) throw new Error();
        enterServer(rememberedServerCode, rememberedName);
      } catch {
        localStorage.removeItem("sonder_last_server_code");
        setAutoRejoining(false);
      }
    };

    tryAutoRejoin();
  }, [shouldAutoRejoin, rememberedServerCode, rememberedName]);

  async function handleCreateServer(e) {
    e.preventDefault();
    if (!serverName.trim()) return setError("Give your server a name first.");
    if (!createUsername.trim()) return setError("Pick a username first.");
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: serverName.trim() }),
      });
      if (!res.ok) throw new Error();
      const server = await res.json();
      enterServer(server.code, createUsername.trim());
    } catch {
      setError("Could not create server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinServer(e) {
    e.preventDefault();
    if (!joinCode.trim()) return setError("Enter a server code first.");
    if (!joinUsername.trim()) return setError("Pick a username first.");
    setLoading(true);
    setError("");
    const code = joinCode.trim().toUpperCase();
    try {
      const res = await fetch(`${API_URL}/servers/${code}`);
      if (!res.ok) throw new Error();
      enterServer(code, joinUsername.trim());
    } catch {
      setError("Server not found. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  }
  if (autoRejoining) {
    return (
      <div className="min-h-screen bg-[#FDEAE1] text-[#3A2E2A] flex items-center justify-center">
        <p className="text-sm text-[#8A7A72]">Reconnecting to your last server...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDEAE1] text-[#3A2E2A] flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <h1
          className="text-4xl font-bold inline-block"
          style={{ transform: "rotate(-2deg)" }}
        >
          sonder <span className="text-[#FF6B4A]">✦</span>
        </h1>
        <p className="text-sm text-[#8A7A72] mt-2">
          Connection, uninterrupted.
        </p>
      </div>

      {/* Feature stickers */}
      <div className="flex gap-2 flex-wrap justify-center mb-8 max-w-md">
        {FEATURE_STICKERS.map((s) => (
          <span
            key={s.label}
            className="rounded-full px-4 py-1.5 text-xs font-medium inline-block"
            style={{ backgroundColor: s.bg, color: s.text, transform: `rotate(${s.rotate})` }}
          >
            {s.label}
          </span>
        ))}
      </div>

      {/* Card */}
      <div
        className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-lg shadow-orange-100/50"
        style={{ transform: "rotate(-0.5deg)" }}
      >
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => {
              setMode("create");
              setError("");
            }}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
              mode === "create" ? "bg-[#FF6B4A] text-white" : "bg-[#FDEAE1] text-[#8A7A72]"
            }`}
          >
            + new server
          </button>
          <button
            onClick={() => {
              setMode("join");
              setError("");
            }}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
              mode === "join" ? "bg-[#FF6B4A] text-white" : "bg-[#FDEAE1] text-[#8A7A72]"
            }`}
          >
            join one
          </button>
        </div>

        {mode === "create" ? (
          <form onSubmit={handleCreateServer} className="space-y-3">
            <input
              type="text"
              placeholder="Server name"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              className="w-full bg-[#FDEAE1] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#FF6B4A] placeholder:text-[#B39A8F] text-sm"
            />
            <input
              type="text"
              placeholder="Pick a username"
              value={createUsername}
              onChange={(e) => setCreateUsername(e.target.value)}
              maxLength={20}
              className="w-full bg-[#FDEAE1] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#FF6B4A] placeholder:text-[#B39A8F] text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FF6B4A] hover:bg-[#FF5733] text-white rounded-xl py-3 font-medium text-sm disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create server ✦"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoinServer} className="space-y-3">
            <input
              type="text"
              placeholder="Server code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="w-full bg-[#FDEAE1] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#FF6B4A] placeholder:text-[#B39A8F] text-sm"
            />
            <input
              type="text"
              placeholder="Pick a username"
              value={joinUsername}
              onChange={(e) => setJoinUsername(e.target.value)}
              maxLength={20}
              className="w-full bg-[#FDEAE1] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#FF6B4A] placeholder:text-[#B39A8F] text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FF6B4A] hover:bg-[#FF5733] text-white rounded-xl py-3 font-medium text-sm disabled:opacity-50"
            >
              {loading ? "Joining..." : "Join server ↗"}
            </button>
          </form>
        )}

        {error && <p className="text-red-500 text-xs mt-3 text-center">{error}</p>}
      </div>
    </div>
  );
}
