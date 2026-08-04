# Sonder

A real-time server-based chat app. The host can create multiple chat rooms within their server, and everyone stays in sync instantly.

## Features

- Server-based chat — a host can create multiple chat rooms
- Anonymous, nickname-based identity — no accounts required
- Real-time messaging powered by Socket.io
- Emoji reactions on messages
- Image uploads in chat (via Multer)
- Message searching and deleting
- Chat history persisted in MongoDB

## Tech Stack

**Frontend:** React, Vite, Tailwind CSS, Zustand, Socket.io-client, Lucide React
**Backend:** Node.js, Express, Socket.io, Mongoose, Multer
**Database:** MongoDB Atlas

## Running locally

### Backend
```bash
cd server
npm install
cp .env.example .env   # then fill in your MongoDB URI
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
---