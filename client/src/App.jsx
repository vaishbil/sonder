import { useState } from "react";
import Home from "./components/Home";
import Room from "./components/Room";

export default function App() {
  const [inRoom, setInRoom] = useState(false);

  return inRoom ? (
    <Room onLeaveRoom={() => setInRoom(false)} />
  ) : (
    <Home onEnterRoom={() => setInRoom(true)} />
  );
}
