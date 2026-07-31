import { create } from "zustand";

export const useRoomStore = create((set) => ({
  roomCode: null,
  isHost: false,
  currentTrack: null,
  playbackState: {
    isPlaying: false,
    positionSeconds: 0,
  },
  messages: [],
  connected: false,

  setRoomCode: (code) => set({ roomCode: code }),
  setIsHost: (isHost) => set({ isHost }),
  setConnected: (connected) => set({ connected }),
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setPlaybackState: (state) =>
    set((prev) => ({
      playbackState: { ...prev.playbackState, ...state },
    })),
  addMessage: (msg) =>
    set((prev) => ({ messages: [...prev.messages, msg] })),
  reset: () =>
    set({
      roomCode: null,
      isHost: false,
      currentTrack: null,
      playbackState: { isPlaying: false, positionSeconds: 0 },
      messages: [],
      connected: false,
    }),
}));
