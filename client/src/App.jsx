import { useState } from "react";
import Home from "./components/Home";
import ServerRoom from "./components/ServerRoom";

export default function App() {
  const [inServer, setInServer] = useState(false);

  return inServer ? (
    <ServerRoom onLeaveServer={() => setInServer(false)} />
  ) : (
    <Home onEnterServer={() => setInServer(true)} />
  );
}
