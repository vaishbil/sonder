import { useEffect, useRef, useState } from "react";
import { Reply as ReplyIcon, Search as SearchIcon } from "lucide-react";
import { socket } from "../socket";
import { useServerStore } from "../store/useServerStore";

const API_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";
const AVATAR_COLORS = ["#FF6B4A", "#FFA07A", "#FF8C69", "#E9967A", "#FFB088", "#F4978E"];

const EMOJIS = [
  "😀", "😂", "😍", "🥳", "😎", "🤔", "😢", "😡", "👍", "👎",
  "🙌", "👏", "🔥", "💯", "🎉", "❤️", "💀", "😭", "🙏", "✨",
  "😴", "🤯", "😅", "🥺", "🫡", "🤝", "👀", "🚀", "💡", "⚡",
];

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "😮", "🙏"];

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

function MessageText({ text, memberNames }) {
  if (!text) return null;
  const parts = text.split(/(@\w+)/g);
  return (
    <p className="text-sm text-[#5A4A42] break-words">
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          const name = part.slice(1);
          const isRealMember = memberNames.some((m) => m.toLowerCase() === name.toLowerCase());
          if (isRealMember) {
            return (
              <span key={i} className="bg-[#FFE3D6] text-[#FF6B4A] font-medium px-1 rounded">
                {part}
              </span>
            );
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

export default function ServerRoom({ onLeaveServer }) {
  const {
    serverCode,
    serverName,
    username,
    isOwner,
    isModerator,
    ownerClientId,
    moderatorClientIds,
    channels,
    currentChannelId,
    members,
    typingUsers,
    setServerState,
    setModeratorClientIds,
    setMembers,
    setCurrentChannel,
    addMessage,
    removeMessage,
    updateReactions,
    addChannel,
    removeChannel,
    setTyping,
    reset,
  } = useServerStore();

  const [messageInput, setMessageInput] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [showNewChannelInput, setShowNewChannelInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [hiddenMessageIds, setHiddenMessageIds] = useState(new Set());
  const [linkCopied, setLinkCopied] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);

  const currentChannel = channels.find((c) => c.channelId === currentChannelId);
  const typingInChannel = (typingUsers[currentChannelId] || []).filter((u) => u !== username);
  const memberNames = members.map((m) => m.username);
  const canManageChannels = isOwner || isModerator;
  const visibleMessages = (currentChannel?.messages || []).filter(
    (m) => !hiddenMessageIds.has(m.messageId)
  );

  useEffect(() => {
    socket.on("server-state", (state) => setServerState(state));
    socket.on("member-joined", ({ members: updatedMembers }) => setMembers(updatedMembers));
    socket.on("member-left", ({ members: updatedMembers }) => setMembers(updatedMembers));
    socket.on("new-message", ({ channelId, message }) => addMessage(channelId, message));
    socket.on("message-deleted", ({ channelId, messageId }) => removeMessage(channelId, messageId));
    socket.on("reaction-updated", ({ channelId, messageId, reactions }) =>
      updateReactions(channelId, messageId, reactions)
    );
    socket.on("moderators-updated", ({ moderatorClientIds }) =>
      setModeratorClientIds(moderatorClientIds)
    );
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
      socket.off("message-deleted");
      socket.off("reaction-updated");
      socket.off("moderators-updated");
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
    socket.emit("send-message", {
      code: serverCode,
      channelId: currentChannelId,
      text,
      replyTo: replyingTo
        ? { messageId: replyingTo.messageId, sender: replyingTo.sender, text: replyingTo.text }
        : undefined,
    });
    socket.emit("stop-typing", { code: serverCode, channelId: currentChannelId, username });
    setMessageInput("");
    setMentionSuggestions([]);
    setReplyingTo(null);
  }

  function handleInputChange(e) {
    const value = e.target.value;
    setMessageInput(value);
    socket.emit("typing", { code: serverCode, channelId: currentChannelId, username });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop-typing", { code: serverCode, channelId: currentChannelId, username });
    }, 2000);

    const match = value.match(/@(\w*)$/);
    if (match) {
      const query = match[1].toLowerCase();
      const matches = memberNames.filter(
        (name) => name.toLowerCase().startsWith(query) && name !== username
      );
      setMentionSuggestions(matches.slice(0, 5));
    } else {
      setMentionSuggestions([]);
    }
  }

  function selectMention(name) {
    const newValue = messageInput.replace(/@(\w*)$/, `@${name} `);
    setMessageInput(newValue);
    setMentionSuggestions([]);
    messageInputRef.current?.focus();
  }

  function insertEmoji(emoji) {
    setMessageInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  }

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/upload`, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Upload response error:", res.status, data);
        throw new Error(data.error || `Upload failed (status ${res.status})`);
      }

      socket.emit("send-message", {
        code: serverCode,
        channelId: currentChannelId,
        text: "",
        attachment: data,
      });
    } catch (err) {
      console.error("Upload error:", err);
      alert(`File upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `${API_URL}/servers/${serverCode}/search?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  }

  function closeSearch() {
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  }

  function jumpToResult(result) {
    setCurrentChannel(result.channelId);
    closeSearch();
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

  function handleKick(targetSocketId, targetUsername) {
    if (!confirm(`Remove ${targetUsername} from this server?`)) return;
    socket.emit("kick-member", { code: serverCode, targetSocketId });
    setMembers(members.filter((m) => m.socketId !== targetSocketId));
  }

  function handleDeleteForEveryone(messageId) {
    if (!confirm("Delete this message for everyone? This can't be undone.")) return;
    socket.emit("delete-message", { code: serverCode, channelId: currentChannelId, messageId });
  }

  function handleDeleteForMe(messageId) {
    setHiddenMessageIds((prev) => new Set(prev).add(messageId));
  }

  function handleReply(message) {
    setReplyingTo({
      messageId: message.messageId,
      sender: message.sender,
      text: message.text || (message.attachment ? "📎 Attachment" : ""),
    });
    messageInputRef.current?.focus();
  }

  function handleToggleReaction(messageId, emoji) {
    socket.emit("toggle-reaction", { code: serverCode, channelId: currentChannelId, messageId, emoji });
    setReactionPickerFor(null);
  }

  function handlePromote(targetClientId) {
    socket.emit("promote-moderator", { code: serverCode, targetClientId });
  }

  function handleDemote(targetClientId) {
    socket.emit("demote-moderator", { code: serverCode, targetClientId });
  }

  function handleCopyInviteLink() {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${serverCode}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  function handleLeave() {
    socket.disconnect();
    localStorage.removeItem("sonder_last_server_code");
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
          <button
            onClick={handleCopyInviteLink}
            className="text-xs text-[#FF6B4A] hover:underline mt-1"
          >
            {linkCopied ? "Link copied!" : "Copy invite link"}
          </button>
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
              {canManageChannels && c.channelId !== "general" && (
                <button
                  onClick={() => handleDeleteChannel(c.channelId)}
                  className="opacity-0 group-hover:opacity-100 text-[#B39A8F] hover:text-red-400 text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {canManageChannels && (
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
        <div className="border-b border-[#FDEAE1] px-5 py-4 flex items-center justify-between">
          <h3 className="font-medium"># {currentChannel?.name || currentChannelId}</h3>
          <button
            onClick={() => (showSearch ? closeSearch() : setShowSearch(true))}
            className="text-[#B39A8F] hover:text-[#FF6B4A]"
            title="Search messages"
          >
            <SearchIcon size={18} />
          </button>
        </div>

        {showSearch && (
          <div className="border-b border-[#FDEAE1] px-5 py-3 bg-[#FFF9F6]">
            <form onSubmit={handleSearch} className="flex gap-2 mb-2">
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search all messages in this server..."
                className="flex-1 bg-white rounded-lg px-3 py-2 text-sm outline-none border border-[#F0DCD1] focus:ring-2 focus:ring-[#FF6B4A]"
              />
              <button
                type="submit"
                disabled={searching}
                className="bg-[#FF6B4A] hover:bg-[#FF5733] text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
              >
                {searching ? "..." : "Search"}
              </button>
              <button
                type="button"
                onClick={closeSearch}
                className="text-[#B39A8F] hover:text-[#FF6B4A] px-2"
                title="Close search"
              >
                ✕
              </button>
            </form>
            {searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => jumpToResult(r)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white text-xs"
                  >
                    <span className="text-[#FF6B4A] font-medium">#{r.channelName}</span>{" "}
                    <span className="text-[#8A7A72]">— {r.sender}: </span>
                    <span className="text-[#5A4A42]">{r.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {visibleMessages.map((m) => {
            const isOwnMessage = m.sender === username;
            const fullImageUrl = m.attachment?.url ? `${API_URL}${m.attachment.url}` : null;

            return (
              <div key={m.messageId || m.timestamp} className="flex items-start gap-2 group">
                <Avatar name={m.sender} size={28} />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-sm text-[#3A2E2A]">{m.sender}</span>{" "}
                  <span className="text-[#B39A8F] text-xs">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>

                  {m.replyTo && (
                    <div className="border-l-2 border-[#FF6B4A] pl-2 mb-1 mt-1">
                      <p className="text-xs text-[#B39A8F]">
                        Replying to <span className="font-medium">{m.replyTo.sender}</span>
                      </p>
                      <p className="text-xs text-[#8A7A72] truncate">{m.replyTo.text}</p>
                    </div>
                  )}

                  <MessageText text={m.text} memberNames={memberNames} />

                  {fullImageUrl && (
                    <div className="relative inline-block mt-1">
                      <a href={fullImageUrl} target="_blank" rel="noopener noreferrer">
                        {m.attachment.type?.startsWith("image/") ? (
                          <img
                            src={fullImageUrl}
                            alt={m.attachment.filename}
                            className="max-w-xs max-h-64 rounded-xl border border-[#F0DCD1]"
                          />
                        ) : (
                          <span className="inline-flex items-center gap-2 bg-[#FDEAE1] rounded-lg px-3 py-2 text-xs text-[#8A7A72] hover:bg-[#FFE3D6]">
                            📎 {m.attachment.filename}
                          </span>
                        )}
                      </a>
                      {isOwnMessage && m.attachment.type?.startsWith("image/") && (
                        <button
                          onClick={() => handleDeleteForEveryone(m.messageId)}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition"
                          title="Delete image for everyone"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}

                  {/* Reaction pills */}
                  {m.reactions?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.reactions.map((r) => {
                        const iReacted = r.usernames.includes(username);
                        return (
                          <button
                            key={r.emoji}
                            onClick={() => handleToggleReaction(m.messageId, r.emoji)}
                            className={`text-xs rounded-full px-2 py-0.5 border transition ${
                              iReacted
                                ? "bg-[#FFE3D6] border-[#FF6B4A] text-[#FF6B4A]"
                                : "bg-[#FDEAE1] border-transparent text-[#8A7A72] hover:border-[#F0DCD1]"
                            }`}
                            title={r.usernames.join(", ")}
                          >
                            {r.emoji} {r.usernames.length}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Hover action bar */}
                  {m.messageId && (
                    <div className="relative opacity-0 group-hover:opacity-100 transition flex gap-3 mt-1 text-xs text-[#B39A8F]">
                      <button
                        onClick={() =>
                          setReactionPickerFor(reactionPickerFor === m.messageId ? null : m.messageId)
                        }
                        className="hover:text-[#FF6B4A]"
                      >
                        😀 React
                      </button>
                      <button onClick={() => handleReply(m)} className="hover:text-[#FF6B4A] flex items-center gap-1">
                        <ReplyIcon size={12} /> Reply
                      </button>
                      <button onClick={() => handleDeleteForMe(m.messageId)} className="hover:text-[#FF6B4A]">
                        Delete for me
                      </button>
                      {isOwnMessage && (
                        <button
                          onClick={() => handleDeleteForEveryone(m.messageId)}
                          className="hover:text-red-500"
                        >
                          Delete for everyone
                        </button>
                      )}

                      {reactionPickerFor === m.messageId && (
                        <div className="absolute bottom-full left-0 mb-1 bg-white border border-[#F0DCD1] rounded-xl shadow-lg p-1.5 flex gap-1 z-10">
                          {QUICK_REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleToggleReaction(m.messageId, emoji)}
                              className="text-lg hover:bg-[#FDEAE1] rounded p-1"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {typingInChannel.length > 0 && (
          <p className="text-xs text-[#B39A8F] px-5 pb-1">
            {typingInChannel.join(", ")} {typingInChannel.length === 1 ? "is" : "are"} typing...
          </p>
        )}

        {replyingTo && (
          <div className="mx-4 mb-2 flex items-center justify-between bg-[#FDEAE1] rounded-lg px-3 py-2">
            <p className="text-xs text-[#8A7A72] truncate">
              Replying to <span className="font-medium">{replyingTo.sender}</span>: {replyingTo.text}
            </p>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-[#B39A8F] hover:text-[#FF6B4A] text-xs ml-2 shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        <div className="relative">
          {mentionSuggestions.length > 0 && (
            <div className="absolute bottom-full left-16 mb-1 bg-white border border-[#F0DCD1] rounded-xl shadow-lg overflow-hidden z-10">
              {mentionSuggestions.map((name) => (
                <button
                  key={name}
                  onClick={() => selectMention(name)}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-[#FDEAE1] text-sm"
                >
                  <Avatar name={name} size={20} />
                  {name}
                </button>
              ))}
            </div>
          )}

          {showEmojiPicker && (
            <div className="absolute bottom-full right-4 mb-1 bg-white border border-[#F0DCD1] rounded-xl shadow-lg p-2 grid grid-cols-6 gap-1 z-10">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="text-xl hover:bg-[#FDEAE1] rounded p-1"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSendMessage} className="p-4 flex gap-2 border-t border-[#FDEAE1]">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.zip,.txt,.docx"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-[#FDEAE1] hover:bg-[#FFE3D6] text-[#8A7A72] rounded-xl px-3 text-lg disabled:opacity-50"
              title="Attach a file"
            >
              {uploading ? "..." : "📎"}
            </button>
            <button
              type="button"
              onClick={() => setShowEmojiPicker((s) => !s)}
              className="bg-[#FDEAE1] hover:bg-[#FFE3D6] text-[#8A7A72] rounded-xl px-3 text-lg"
              title="Emoji"
            >
              😀
            </button>
            <input
              ref={messageInputRef}
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
      </div>

      {/* Member list */}
      <div className="w-52 bg-white m-3 ml-0 rounded-2xl p-4 shadow-sm">
        <p className="text-xs text-[#B39A8F] uppercase tracking-wide mb-3">
          Online — {members.length}
        </p>
        <div className="space-y-2">
          {members.map((m) => {
            const targetIsOwner = m.clientId === ownerClientId;
            const targetIsModerator = moderatorClientIds.includes(m.clientId);
            const isMe = m.socketId === socket.id;

            // Only the owner can kick a moderator (or the owner, never);
            // moderators can kick regular members only
            const canKick =
              !isMe &&
              !targetIsOwner &&
              (isOwner || (isModerator && !targetIsModerator));

            return (
              <div key={m.socketId} className="flex items-center justify-between group">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative shrink-0">
                    <Avatar name={m.username} size={30} />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full" />
                  </div>
                  <span className="text-sm text-[#3A2E2A] truncate flex items-center gap-1">
                    {m.username}
                    {targetIsOwner && <span title="Owner">👑</span>}
                    {targetIsModerator && !targetIsOwner && <span title="Moderator">🛡️</span>}
                    {isMe && <span className="text-[#B39A8F]">(you)</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isOwner && !targetIsOwner && !isMe && (
                    <button
                      onClick={() =>
                        targetIsModerator ? handleDemote(m.clientId) : handlePromote(m.clientId)
                      }
                      className="text-xs text-[#B39A8F] hover:text-[#FF6B4A]"
                    >
                      {targetIsModerator ? "remove mod" : "make mod"}
                    </button>
                  )}
                  {canKick && (
                    <button
                      onClick={() => handleKick(m.socketId, m.username)}
                      className="text-xs text-[#B39A8F] hover:text-red-400"
                    >
                      kick
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
