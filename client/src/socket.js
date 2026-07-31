import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";

// One shared socket instance for the whole app
export const socket = io(SERVER_URL, {
  autoConnect: false, // we connect manually once we know the room code
});
