# Friendly Feud — Claude Code Session Notes

> **Notes for future sessions:** 
> - This file is the source of truth for project architecture and decisions. Implement all code following this file's architecture and decisions. When changing architecture or decisions, always update this file before implementing code. 
> - Use comments when necessary to explain code implementation
> - Never hard code colors in tailwind, always define colors used in `app/app.css` `@theme` 

## Overview

A real-time multiplayer web game inspired by Family Feud. Instead of 100 surveyed strangers, **your friends** are the respondents. Players join a lobby, answer a question, then take turns guessing each other's answers. Correct guesses earn points for both the guesser and the matched player.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router v7 (SSR, framework mode) |
| Backend | Express v5 (via `server/app.ts`), Node.js |
| Real-time | Socket.io (to be added) |
| Styling | Tailwind CSS v4 |
| Language | TypeScript throughout |
| Build | Vite + `@react-router/dev` |

Dev server: `npm run dev` (runs `server.js` which loads `server/app.ts`)
The React Router SSR build is served via `@react-router/express`'s `createRequestHandler`.

## Project Structure

```
friendly-feud/
├── server/               # Express backend
│   ├── app.ts            # Express app + Socket.io setup (existing entry point)
│   ├── GameManager.ts    # Manages all active lobbies (Map<lobbyCode, GameRoom>)
│   ├── GameRoom.ts       # Per-lobby state machine + game logic
│   ├── scoring.ts        # Point calculation logic
│   └── data/
│       └── questions.json  # Question bank (served randomly)
├── app/                  # React Router frontend
│   ├── root.tsx          # App shell
│   ├── routes.ts         # Route definitions
│   ├── routes/
│   │   ├── home.tsx         # "/" — create or join lobby
│   │   ├── lobby.$code.tsx  # "/lobby/:code" — waiting room
│   │   ├── game.$code.tsx   # "/game/:code" — active game screen
│   │   └── results.$code.tsx # "/results/:code" — final scoreboard
│   ├── hooks/
│   │   └── useSocket.ts     # Socket.io client hook
│   └── components/
│       ├── Lobby.tsx
│       ├── QuestionDisplay.tsx
│       ├── AnswerInput.tsx
│       ├── GuessInput.tsx
│       ├── Scoreboard.tsx
│       └── PlayerList.tsx
├── server.js             # Node entry — imports server/app.ts, starts HTTP server
├── react-router.config.ts
└── vite.config.ts
```

## Game Flow

### Phases (game state machine per room)

```
waiting → answering → guessing → round_end ─┐
              ↑___________________________|  │  (repeat 3 rounds)
                                             ↓
                                         game_end
```

| Phase | Description |
|---|---|
| `waiting` | Players join lobby. Host starts when ready. |
| `answering` | A question is shown. All players submit their answer (hidden from others). |
| `guessing` | Players take turns. On your turn, guess an answer. |
| `round_end` | Reveal all answers and round scores. Brief pause before next round. |
| `game_end` | Show final scores and winner after 3 rounds. |

### Guessing Rules

- On each player's turn, they submit a guess for other players' answers.
- A guess is correct if it matches (case-insensitive, trimmed OR Claude API call, configurable in .env) the target player's submitted answer.
- Each player gets **one guess attempt per turn** (TBD: allow multiple guesses per turn?).
- Players rotate turns until all players have had a turn (or some time limit — TBD).

### Scoring

- **Unique answer match**: guesser + matched player each earn **100 points**.
- **Shared answer match** (multiple people gave the same answer): guesser + all matched players each earn `floor(100 / matchCount)` points.
- Computed in `server/scoring.ts`.

## Data Format

### questions.json (example shape)

```json
[
  {
    "id": "q1",
    "prompt": "Name something you do before bed.",
    "category": "Daily Life"
  }
]
```

Questions are selected randomly without repeating within a game session.

### Lobby/Room state (server-side, in GameRoom)

```ts
{
  code: string,           // 4-letter room code
  hostId: string,         // socket ID of host
  phase: GamePhase,
  players: Map<socketId, Player>,
  currentRound: number,   // 1–3
  currentQuestion: Question,
  answers: Map<socketId, string>,   // submitted answers (hidden during answering phase)
  currentGuesserIndex: number,      // whose turn it is in guessing phase
  scores: Map<socketId, number>,
}
```

## Socket.io Events

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `create_lobby` | `{ playerName }` | Create a new lobby, get back a code |
| `join_lobby` | `{ code, playerName }` | Join existing lobby |
| `start_game` | — | Host only: begin the game |
| `submit_answer` | `{ answer: string }` | Player submits their answer during answering phase |
| `submit_guess` | `{ targetId: string, guess: string }` | Player guesses during guessing phase |
| `next_round` | — | Host only: advance to next round (or game_end) |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `lobby_update` | `{ players, hostId }` | Broadcast whenever player list changes |
| `phase_change` | `{ question, phase }` | State machine transition |
| `guess_result` | `{ correct, points, guesser, targets }` | Result of a guess |
| `round_end` | `{ answers, scores }` | Reveal all answers + scores |
| `game_end` | `{ scores, winner }` | Final results |
| `error` | `{ message }` | Error feedback |

## Implementation Notes

- Socket.io server should be attached to the same HTTP server that Express uses (in `server.js`).
- `GameManager` is a singleton instantiated once and passed into socket event handlers.
- Lobby codes: 4 random uppercase letters (e.g. `WXYZ`), checked for uniqueness against active rooms.
- React Router routes use loaders only for static data (e.g. initial page render); all game state comes through Socket.io, not HTTP.
- The `useSocket.ts` hook manages the socket connection lifecycle and exposes game state via React context or local state.

## Status

- [ ] Backend: Socket.io + GameManager + GameRoom skeleton
- [ ] Backend: questions.json with ~20 example questions
- [ ] Backend: scoring.ts
- [ ] Backend: integrate Claude API calls
- [ ] Frontend: home route (create/join lobby)
- [ ] Frontend: lobby route (waiting room)
- [ ] Frontend: game route (answering + guessing phases)
- [ ] Frontend: results route (final scoreboard)
- [ ] Frontend: useSocket hook + game state wiring