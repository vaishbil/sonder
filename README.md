# Sonder

A real-time synced listening room — multiple people join a room, one host's playback controls the session, and everyone stays in sync automatically.

## Features

- Create or join a room with a short code
- Host-controlled playback (play/pause) synced to all participants in real time
- Automatic host reassignment if the host disconnects
- Live chat within the room
- Track search powered by the Jamendo API (royalty-free music)
- Room state persisted in MongoDB, so sessions survive rejoins

## Tech Stack

**Frontend:** React, Vite, Tailwind CSS, Zustand, Socket.io-client
**Backend:** Node.js, Express, Socket.io, Mongoose
**Database:** MongoDB Atlas
**Music:** Jamendo API 

## How the sync engine works

Whoever creates a room becomes the host. Only the host can trigger play/pause/seek events — these are broadcast via Socket.io to every other client in the room, tagged with a server timestamp so clients can reconcile network delay. If the host disconnects, the server automatically promotes another participant to host, keeping the room alive.

## Running locally

### Backend
```bash
cd server
npm install
cp .env.example .env   # then fill in your MongoDB URI and Jamendo Client ID
npm run dev
```

### Frontend
```bash
cd client
npm install
cp .env.example .env   # then fill in your backend URL
npm run dev
```

## Environment Variables

**server/.env**