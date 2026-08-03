import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { useServerStore } from "../store/useServerStore";

const AVATAR_COLORS = ["#FF6B4A", "#FFA07A", "#FF8C69", "#E9967A", "#FFB088", "#F4978E"];

function avatarColor(name) {
  const index = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function Avatar({ name, size = 32 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-medium shrink-0"
      style={{ width: size, height: size, backgroundColor: avatarColor(name), fontSize: size * 0.4 }}
    >
      {name?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );
}

export default function ServerRoom({ onLeaveServer }) {
  const {
    serverCode,
    serverName,
    username,
    isOwner,
    channels,
    currentChannelId,
    members,
    typingUsers,
    setServerState,
    setMembers,
    setCurrentChannel,
    addMessage,
    addChannel,
    removeChannel,
    setTyping,
    reset,
  } = useServerStore();

  const [messageInput, setMessageInput] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [showNewChannelInput, setShowNewChannelInput] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const currentChannel = channels.find((c) => c.channelId === currentChannelId);
  const typingInChannel = (typingUsers[currentChannelId] || []).filter((u) => u !== username);

  useEffect(() => {
    socket.on("server-state", (state) => setServerState(state));
    socket.on("member-joined", ({ members: updatedMembers }) => setMembers(updatedMembers));
    socket.on("member-left", ({ members: updatedMembers }) => setMembers(updatedMembers));
    socket.on("new-message", ({ channelId, message }) => addMessage(channelId, message));
    socket.on("channel-created", (channel) => addChannel(channel));
    socket.on("channel-deleted", ({ channelId }) => removeChannel(channelId));
    socket.on("user-typing", ({ channelId, username: u }) => setTyping(channelId, u, true));
    socket.on("user-stopped-typing", ({ channelId, username: u }) => setTyping(channelId, u, false));
    socket.on("kicked", () => {
      alert("You've been removed from this server.");
      handleLeave();
    });
    socket.on("error-message", (msg) => alert(msg));

    return () => {
      socket.off("server-state");
      socket.off("member-joined");
      socket.off("member-left");
      socket.off("new-message");
      socket.off("channel-created");
      socket.off("channel-deleted");
      socket.off("user-typing");
      socket.off("user-stopped-typing");
      socket.off("kicked");
      socket.off("error-message");
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChannel?.messages?.length]);

  function handleSendMessage(e) {
    e.preventDefault();
    const text = messageInput.trim();
    if (!text) return;
    socket.emit("send-message", { code: serverCode, channelId: currentChannelId, text });
    socket.emit("stop-typing", { code: serverCode, channelId: currentChannelId, username });
    setMessageInput("");
  }

  function handleInputChange(e) {
    setMessageInput(e.target.value);
    socket.emit("typing", { code: serverCode, channelId: currentChannelId, username });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop-typing", { code: serverCode, channelId: currentChannelId, username });
    }, 2000);
  }

  function handleCreateChannel(e) {
    e.preventDefault();
    const name = newChannelName.trim();
    if (!name) return;
    socket.emit("create-channel", { code: serverCode, name });
    setNewChannelName("");
    setShowNewChannelInput(false);
  }

  function handleDeleteChannel(channelId) {
    if (channelId === "general") return;
    socket.emit("delete-channel", { code: serverCode, channelId });
  }

  function handleKick(targetSocketId) {
    socket.emit("kick-member", { code: serverCode, targetSocketId });
  }

  function handleLeave() {
    socket.disconnect();
    reset();
    onLeaveServer();
  }

  return (
    <div className="min-h-screen bg-[#FDEAE1] text-[#3A2E2A] flex">
      {/* Channel sidebar */}
      <div className="w-56 bg-white m-3 mr-0 rounded-2xl flex flex-col p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="font-bold text-sm truncate text-[#3A2E2A]">{serverName || "Server"}</h2>
          <p className="text-xs text-[#B39A8F]">Code: {serverCode}</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          <p className="text-xs text-[#B39A8F] uppercase tracking-wide mb-1">Channels</p>
          {channels.map((c) => (
            <div key={c.channelId} className="flex items-center group">
              <button
                onClick={() => setCurrentChannel(c.channelId)}
                className={`flex-1 text-left px-2 py-1.5 rounded-lg text-sm truncate transition ${
                  currentChannelId === c.channelId
                    ? "bg-[#FF6B4A] text-white"
                    : "text-[#8A7A72] hover:bg-[#FDEAE1]"
                }`}
              >
                # {c.name}
              </button>
              {isOwner && c.channelId !== "general" && (
                <button
                  onClick={() => handleDeleteChannel(c.channelId)}
                  className="opacity-0 group-hover:opacity-100 text-[#B39A8F] hover:text-red-400 text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {isOwner && (
            <div className="mt-2">
              {showNewChannelInput ? (
                <form onSubmit={handleCreateChannel} className="flex gap-1">
                  <input
                    type="text"
                    autoFocus
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    onBlur={() => !newChannelName && setShowNewChannelInput(false)}
                    placeholder="channel-name"
                    className="flex-1 bg-[#FDEAE1] rounded-lg px-2 py-1 text-xs outline-none"
                  />
                </form>
              ) : (
                <button
                  onClick={() => setShowNewChannelInput(true)}
                  className="text-xs text-[#B39A8F] hover:text-[#FF6B4A] px-2"
                >
                  + Add channel
                </button>
              )}
            </div>
          )}
        </div>

        <button onClick={handleLeave} className="text-xs text-[#B39A8F] hover:text-[#FF6B4A] mt-4">
          Leave server
        </button>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col m-3 bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="border-b border-[#FDEAE1] px-5 py-4">
          <h3 className="font-medium"># {currentChannel?.name || currentChannelId}</h3>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {(currentChannel?.messages || []).map((m, i) => (
            <div key={i} className="flex items-start gap-2">
              <Avatar name={m.sender} size={28} />
              <div>
                <span className="font-medium text-sm text-[#3A2E2A]">{m.sender}</span>{" "}
                <span className="text-[#B39A8F] text-xs">
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <p className="text-sm text-[#5A4A42]">{m.text}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {typingInChannel.length > 0 && (
          <p className="text-xs text-[#B39A8F] px-5 pb-1">
            {typingInChannel.join(", ")} {typingInChannel.length === 1 ? "is" : "are"} typing...
          </p>
        )}

        <form onSubmit={handleSendMessage} className="p-4 flex gap-2 border-t border-[#FDEAE1]">
          <input
            type="text"
            value={messageInput}
            onChange={handleInputChange}
            placeholder={`Message #${currentChannel?.name || currentChannelId}`}
            className="flex-1 bg-[#FDEAE1] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#FF6B4A] placeholder:text-[#B39A8F]"
          />
          <button
            type="submit"
            className="bg-[#FF6B4A] hover:bg-[#FF5733] text-white rounded-xl px-5 py-2.5 text-sm font-medium"
          >
            Send
          </button>
        </form>
      </div>

      {/* Member list */}
      <div className="w-52 bg-white m-3 ml-0 rounded-2xl p-4 shadow-sm">
        <p className="text-xs text-[#B39A8F] uppercase tracking-wide mb-3">
          Online — {members.length}
        </p>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.socketId} className="flex items-center justify-between group">
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative shrink-0">
                  <Avatar name={m.username} size={30} />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full" />
                </div>
                <span className="text-sm text-[#3A2E2A] truncate">
                  {m.username}
                  {m.socketId === socket.id && (
                    <span className="text-[#B39A8F]"> (you)</span>
                  )}
                </span>
              </div>
              {isOwner && m.socketId !== socket.id && (
                <button
                  onClick={() => handleKick(m.socketId)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-[#B39A8F] hover:text-red-400 shrink-0"
                >
                  kick
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
