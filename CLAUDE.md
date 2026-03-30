# Friendly Feud — Claude Code Session Notes

> **Notes for future sessions:** 
> - Use comments when necessary to explain code implementation
> - Never hard code colors in tailwind, always define colors used in `app/app.css` `@theme` 
> - All API endpoint should be seperate files

## Overview

A real-time multiplayer web game inspired by Family Feud. Instead of 100 surveyed strangers, **your friends** are the respondents. Players join a lobby, answer a question, then take turns guessing each other's answers. Correct guesses earn points for both the guesser and the matched player.

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router v7 (SSR, framework mode) |
| Backend | Express v5 (via `server/app.ts`), Node.js |
| Real-time | Socket.io (to be added) |
| Styling | Tailwind CSS v4 |
| Language | TypeScript throughout |
| Build | Vite + `@react-router/dev` |

## Project Structure

```
friendly-feud/
├── server/               # Express backend
│   ├── app.ts            # Express app entry point
│   └── data/             # Question bank and other static data
├── app/                  # React Router frontend
│   ├── root.tsx          # App shell
│   ├── routes.ts         # Route definitions
│   ├── app.css           # Global styles + Tailwind @theme color definitions
│   ├── routes/
│   │   └── home.tsx      # "/" — create or join lobby
│   ├── hooks/            # (planned) Custom React hooks (e.g. useSocket.ts)
│   └── components/       # (planned) Shared UI components
├── public/               # Static assets
│   └── favicon.ico
├── server.js             # Node entry — imports server/app.ts, starts HTTP server
├── react-router.config.ts
├── vite.config.ts
├── tsconfig.json
└── Dockerfile
```