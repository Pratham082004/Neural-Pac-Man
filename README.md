# Neural Pac-Man

An active reinforcement learning project training a **Deep Q-Network (DQN)** agent to play a browser-based Pac-Man game.

The project connects a PyTorch-based neural network backend to a JavaScript-based Pac-Man frontend using WebSockets. The agent observes the game state, selects actions (UP, DOWN, LEFT, RIGHT), and receives rewards based on its gameplay performance to continuously improve its policy.

---

## Architecture

The project is split into two main components communicating over WebSockets:

1. **Frontend (Game Environment)**: A modified browser-based Pac-Man game (HTML5/JavaScript) that sends game state and transitions to the backend, and executes the received actions.
2. **Backend (DQN Agent)**: A Python PyTorch server (`bridge/server.py`) that processes the incoming game state, uses a DQN (`agent/dqn.py`) to select the best action, and trains on the resulting rewards.

```text
       👀 GAME STATE
             ↓
    🌐 WEBSOCKET (8765)
             ↓
       🧠 DQN AGENT
             ↓
    🎮 ACTION (U/D/L/R)
             ↓
       🟡 PAC-MAN
             ↓
         📈 REWARD
             ↺
```

---

## Getting Started

You can run the project either using Docker (recommended for running on a remote device or home server) or locally.

### Option 1 — Docker (Recommended)

To run the game and the AI backend simultaneously using Docker:

1. Open a terminal in the root directory.
2. Run the following command:

```bash
docker-compose up -d --build
```

3. Open a web browser on any device in your network and navigate to:

```text
http://<SERVER_IP>:8080/debug.htm
```
*(Replace `<SERVER_IP>` with the IP address of the machine running Docker, or `localhost` if running locally)*

### Option 2 — Local Development

If you prefer to run it manually:

**1. Start the AI Backend:**
```bash
pip install -r requirements.txt
python -m bridge.server
```

**2. Start the Game Server:**
In a separate terminal, navigate to the game directory and start an HTTP server:
```bash
cd game/pacman
python -m http.server 8080
```

**3. Play/Train:**
Open `http://localhost:8080/debug.htm` in your browser.

---

## Training & Checkpoints

The agent trains continuously while the game is running. 
- **Checkpoints**: The neural network weights and training statistics are automatically saved to `checkpoints/pacman_dqn.pth` at the end of every episode.
- **Resuming**: The backend automatically loads the latest checkpoint when started, allowing you to stop and resume training at any time without losing progress.

---

## Attribution

The browser-based Pac-Man implementation used in this project is based on **web-pacman** by [Alex313031](https://github.com/Alex313031/web-pacman).

The original game's license (GPL-3.0) and copyright notices are retained in `game/pacman/LICENSE`. This project adds experimental AI-related modifications, a WebSocket bridge, and reinforcement learning code around the original game.

## Disclaimer
This project is intended for education, experimentation, and learning about machine learning and reinforcement learning. It is not intended to reproduce or distribute proprietary Pac-Man game software, ROMs, or proprietary assets.
