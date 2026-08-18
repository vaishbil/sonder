# Sonder

A real-time community chat platform — create servers, organize conversations into channels, and chat live with friends.

## Features

- **Servers & channels** — create a server with a shareable code, organize conversations into multiple channels (`#general` + custom ones)
- **Real-time messaging** — instant delivery via Socket.io, with typing indicators and live online presence
- **Persistent identity** — ownership and moderator roles survive refreshes and reconnects via a permanent client ID, not just a temporary socket connection
- **Roles & moderation** — owners can promote members to moderator, with tiered permissions for kicking members and managing channels
- **Emoji reactions** — react to any message with a live-updating count, synced instantly across everyone in the room
- **File & image sharing** — drag in an image or file, hosted on Cloudinary and previewed inline in chat
- **Message search** — search across every channel in a server
- **@mentions** — autocomplete suggestions as you type, with highlighted mentions in chat
- **Threaded replies** — reply to a specific message with a quoted preview
- **Message controls** — delete for yourself, or delete for everyone (sender-only)
- **Invite links** — share a link that auto-fills the server code for anyone who opens it
- **Auto-rejoin** — refreshing the page reconnects you to your last server automatically
- **Responsive layout** — sidebars collapse into slide-out panels on smaller screens, so the app works cleanly on mobile as well as desktop

## Tech Stack

**Frontend:** React, Vite, Tailwind CSS, Zustand, Socket.io-client, Lucide Icons
**Backend:** Node.js, Express, Socket.io, Mongoose
**Database:** MongoDB Atlas
**File storage:** Cloudinary

## How it works

Each server tracks its own channels, members, roles, and message history in MongoDB. Real-time events (messages, reactions, typing, presence, channel changes) are broadcast through Socket.io rooms scoped to each server's code.

Ownership and identity are tied to a persistent `clientId` generated once per browser and stored in `localStorage` — not the temporary socket connection ID, which changes on every reconnect. This means a server's owner and moderators keep their permissions even after a refresh, tab close, or dropped connection, without needing a full authentication system.

## Running locally

### Backend
```bash
cd server
npm install
cp .env.example .env   # fill in your MongoDB URI and Cloudinary credentials
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