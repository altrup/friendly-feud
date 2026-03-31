# [Friendly Feud](https://friendlyfeud.dkg.zone/)
A social game inspired by Family Feud! Answer a prompt, and try to guess each other's answers. Both the guesser and the answerer are rewarded points when a succesful guess is made.

## Setup
Guide to running the game

### Prerequisites
- Docker Compose ([installation guide](https://docs.docker.com/compose/install/))

### Installation & Usage
- Clone repository
  
  ```bash
  git clone https://github.com/altrup/friendly-feud.git
  ```
- Enter newly created folder
  
  ```bash
  cd friendly-feud
  ```
- Copy [`.env.example`](/.env.example) and update to your values
  
  ```bash
  cp .env.example .env
  ```
- Start Docker container

  ```bash
  docker compose up -d
  ```
- To stop, run

  ```bash
  docker compose down
  ```
- To update, run

  ```bash
  docker compose build
  ```

### Testing
- For testing changes, instead of using docker and rebuilding every time, you can also run using npm
- Install npm packages
  
  ```bash
  npm install
  ```
- Run website
  
  ```bash
  npm run dev
  ```