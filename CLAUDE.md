# Friendly Feud — Claude Code Session Notes

> **Notes for future sessions:** 
> - Use comments when necessary to explain code implementation
> - Never hard code colors in tailwind, always define colors used in `app/app.css` `@theme`

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
