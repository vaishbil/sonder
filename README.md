# Sonder

A real-time community chat platform, create servers, organize conversations into channels, and chat live with friends.

## Features

- **Servers & channels** — create a server with a shareable code, organize conversations into multiple channels (`#general` + custom ones)
- **Real-time messaging** — instant delivery via Socket.io, with typing indicators and live online presence
- **Persistent identity** — ownership and session state survive refreshes and reconnects via a permanent client ID, not just a temporary socket connection
- **File & image sharing** — drag in an image or file, previewed inline in chat
- **Message search** — search across every channel in a server
- **@mentions** — autocomplete suggestions as you type, with highlighted mentions in chat
- **Threaded replies** — reply to a specific message with a quoted preview
- **Message controls** — delete for yourself, or delete for everyone (sender-only)
- **Invite links** — share a link that auto-fills the server code for anyone who opens it
- **Auto-rejoin** — refreshing the page reconnects you to your last server automatically
- **Owner controls** — kick members, create/delete channels (owner-only, tied to persistent identity so it survives disconnects)

## Tech Stack

**Frontend:** React, Vite, Tailwind CSS, Zustand, Socket.io-client, Lucide Icons
**Backend:** Node.js, Express, Socket.io, Mongoose
**Database:** MongoDB Atlas
**File storage:** Local disk (via Multer) — would move to S3/Cloudinary at production scale

## How it works

Each server tracks its own channels, members, and message history in MongoDB. Real-time events (messages, typing, presence, channel changes) are broadcast through Socket.io rooms scoped to each server's code.

Ownership and identity are tied to a persistent `clientId` generated once per browser and stored in `localStorage` — not the temporary socket connection ID, which changes on every reconnect. This means a server's owner keeps their admin rights even after a refresh, tab close, or dropped connection, without needing a full authentication system.

## Running locally

### Backend
```bash
cd server
npm install
cp .env.example .env   # fill in your MongoDB URI
npm run dev
```

### Frontend
```bash
cd client
npm install
cp .env.example .env   # fill in your backend URL
npm run dev
```

## Environment Variables

**server/.env**