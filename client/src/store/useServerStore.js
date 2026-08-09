import { create } from "zustand";

export const useServerStore = create((set) => ({
  serverCode: null,
  serverName: null,
  username: null,
  isOwner: false,
  isModerator: false,
  ownerClientId: null,
  moderatorClientIds: [],
  channels: [],
  currentChannelId: "general",
  members: [],
  typingUsers: {}, // { channelId: [usernames] }
  connected: false,

  setServerCode: (code) => set({ serverCode: code }),
  setUsername: (username) => set({ username }),
  setServerState: ({ name, channels, members, isOwner, isModerator, ownerClientId, moderatorClientIds }) =>
    set({
      serverName: name,
      channels,
      members,
      isOwner,
      isModerator: isModerator || false,
      ownerClientId: ownerClientId || null,
      moderatorClientIds: moderatorClientIds || [],
    }),
  setIsOwner: (isOwner) => set({ isOwner }),
  setModeratorClientIds: (moderatorClientIds) => set({ moderatorClientIds }),
  setMembers: (members) => set({ members }),
  setCurrentChannel: (channelId) => set({ currentChannelId: channelId }),

  addMessage: (channelId, message) =>
    set((state) => ({
      channels: state.channels.map((c) =>
        c.channelId === channelId
          ? { ...c, messages: [...c.messages, message] }
          : c
      ),
    })),

  removeMessage: (channelId, messageId) =>
    set((state) => ({
      channels: state.channels.map((c) =>
        c.channelId === channelId
          ? { ...c, messages: c.messages.filter((m) => m.messageId !== messageId) }
          : c
      ),
    })),

  updateReactions: (channelId, messageId, reactions) =>
    set((state) => ({
      channels: state.channels.map((c) =>
        c.channelId === channelId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.messageId === messageId ? { ...m, reactions } : m
              ),
            }
          : c
      ),
    })),

  addChannel: (channel) =>
    set((state) => ({ channels: [...state.channels, channel] })),

  removeChannel: (channelId) =>
    set((state) => ({
      channels: state.channels.filter((c) => c.channelId !== channelId),
      currentChannelId:
        state.currentChannelId === channelId ? "general" : state.currentChannelId,
    })),

  setTyping: (channelId, username, isTyping) =>
    set((state) => {
      const current = state.typingUsers[channelId] || [];
      const updated = isTyping
        ? [...new Set([...current, username])]
        : current.filter((u) => u !== username);
      return { typingUsers: { ...state.typingUsers, [channelId]: updated } };
    }),

  reset: () =>
    set({
      serverCode: null,
      serverName: null,
      isOwner: false,
      isModerator: false,
      ownerClientId: null,
      moderatorClientIds: [],
      channels: [],
      currentChannelId: "general",
      members: [],
      typingUsers: {},
      connected: false,
    }),
}));
