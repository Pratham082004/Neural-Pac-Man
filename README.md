# Neural Pacman

A learning-focused project that combines a browser-based Pac-Man game with progressively more advanced **neural network and reinforcement learning concepts**.

The goal of this project is to eventually train a neural-network-based agent to play Pac-Man using **Deep Q-Learning (DQN)**.

Rather than jumping directly into a pre-built AI library, the project is being developed step-by-step to understand the underlying concepts behind neural networks, Q-learning, reinforcement learning, and DQN.

---

## Project Goal

The ultimate goal is to create an AI agent that can:

```text
Observe the Pac-Man game
        ↓
Understand the current state
        ↓
Choose UP / DOWN / LEFT / RIGHT
        ↓
Interact with the game
        ↓
Receive rewards / penalties
        ↓
Learn from experience
        ↓
Improve its gameplay
```

The project will progress from a simple structured game-state representation toward a more advanced **pixel-based neural network agent**.

---

## Learning Roadmap

The project is intentionally being developed as a learning exercise.

### Phase 1 — Neural Network Fundamentals

Implemented through small Python experiments:

* Basic numerical operations
* Predictions
* Loss functions
* Gradient descent
* Weight updates
* Backpropagation
* Activation functions
* XOR learning

### Phase 2 — Reinforcement Learning

Learning the fundamentals of:

* Agent
* Environment
* State
* Action
* Reward
* Q-values
* Exploration vs. exploitation
* Epsilon-greedy strategy
* Q-learning
* Bellman equation

### Phase 3 — Pac-Man Environment

Integrating an existing browser-based Pac-Man implementation with our AI:

* Inspecting the game architecture
* Understanding Pac-Man's movement system
* Accessing Pac-Man's position and direction
* Accessing ghost information
* Accessing maze and pellet information
* Creating an external AI control interface

### Phase 4 — Deep Q-Network

Replace the Q-table with a neural network:

```text
Game State
    ↓
Neural Network
    ↓
Q(UP)
Q(DOWN)
Q(LEFT)
Q(RIGHT)
    ↓
Choose Action
```

### Phase 5 — Training

The AI will learn through repeated interaction with the game:

```text
State
  ↓
DQN
  ↓
Action
  ↓
Pac-Man
  ↓
Reward
  ↓
New State
  ↓
Replay Buffer
  ↓
Neural Network Update
```

### Phase 6 — Advanced Version

The eventual goal is to experiment with:

```text
Game Pixels
    ↓
CNN
    ↓
DQN
    ↓
Action
    ↓
Pac-Man
```

This would allow the agent to learn from the actual game screen rather than relying entirely on manually engineered state features.

---

# Project Structure

```text
neural-pacman/
│
├── game/
│   └── pacman/
│       ├── src/
│       │   ├── Actor.js
│       │   ├── Player.js
│       │   ├── Ghost.js
│       │   ├── Map.js
│       │   ├── direction.js
│       │   ├── game.js
│       │   ├── input.js
│       │   └── ...
│       │
│       ├── debug.htm
│       ├── index.html
│       ├── pacman.js
│       ├── LICENSE
│       └── ...
│
├── lessons/
│   ├── l1.py
│   ├── l2.py
│   ├── l3.py
│   ├── l4.py
│   ├── l5.py
│   └── ...
│
├── agent/
│   └── ...
│
├── environment/
│   └── ...
│
├── checkpoints/
│   └── ...
│
├── logs/
│   └── ...
│
└── README.md
```

> The `agent`, `environment`, `checkpoints`, and `logs` directories are intended for the later DQN implementation.

---

# Pac-Man Game

The browser-based Pac-Man implementation is based on:

**web-pacman**
https://github.com/Alex313031/web-pacman

The original implementation is retained under:

```text
game/pacman/
```

The original repository includes its own documentation and license.

## License

The original Pac-Man implementation is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

The original `LICENSE` file is retained in:

```text
game/pacman/LICENSE
```

This project adds experimental AI-related modifications and learning code around the original game.

If this project is distributed, the applicable GPL-3.0 requirements for the original covered source must be followed.

---

# Running the Pac-Man Game

## Option 1 — Local HTTP Server

Navigate to the Pac-Man directory:

```bash
cd game/pacman
```

Start a local server:

```bash
python -m http.server 8080
```

Open:

```text
http://localhost:8080/
```

---

## Debug Version

During development, the project uses:

```text
http://localhost:8080/debug.htm
```

The debug page loads the individual JavaScript source files from:

```text
game/pacman/src/
```

This makes it easier to inspect and modify the game's internal systems.

---

# Current AI Integration

The project currently contains an experimental AI interface in:

```text
game/pacman/src/ai.js
```

The interface allows programmatic control of Pac-Man.

For example:

```javascript
neuralAI.up()
neuralAI.down()
neuralAI.left()
neuralAI.right()
```

These commands eventually call the game's existing Pac-Man control mechanism:

```text
neuralAI
    ↓
pacman.setInputDir()
    ↓
Player.steer()
    ↓
Pac-Man movement
```

This provides the foundation for replacing manual keyboard input with decisions generated by a reinforcement-learning agent.

---

# Understanding the Existing Game

The Pac-Man source code provides several useful components for building the AI environment.

### `Player.js`

Responsible for Pac-Man's:

* Movement
* Direction
* Input
* Position
* Tile coordinates
* Eating pellets
* Interaction with the maze

### `Actor.js`

Provides common actor functionality:

* Pixel position
* Tile position
* Direction
* Movement
* Tile calculations
* Distance from tile center

Both Pac-Man and ghosts inherit from `Actor`.

### `Ghost.js`

Contains ghost behavior and state, including:

* Ghost position
* Direction
* Movement
* Targeting
* Ghost modes
* Scared/frightened state

### `Map.js`

Contains the maze representation and provides information about:

* Walkable tiles
* Walls
* Pellets
* Power pellets
* Tunnels
* Maze layout

### `direction.js`

Defines the four possible actions:

```text
0 → UP
1 → LEFT
2 → DOWN
3 → RIGHT
```

These will eventually correspond to the four output neurons of the DQN.

---

# Planned DQN Architecture

The first DQN version is planned to use a structured game-state representation.

Conceptually:

```text
                Game State
                    ↓
              State Vector
                    ↓
              ┌───────────┐
              │   Dense   │
              │   Layer   │
              └─────┬─────┘
                    ↓
              ┌───────────┐
              │   Dense   │
              │   Layer   │
              └─────┬─────┘
                    ↓
          ┌─────┬─────┬─────┬─────┐
          ↓     ↓     ↓     ↓
         UP   LEFT  DOWN  RIGHT
```

The network will output one Q-value for each possible action.

The action with the highest estimated Q-value can then be selected during exploitation.

---

# Planned State Representation

The first version will experiment with information such as:

* Pac-Man tile position
* Pac-Man direction
* Available directions
* Nearby walls
* Ghost positions
* Ghost distance
* Ghost state
* Nearby pellets
* Power-pellet state

The state representation will evolve as the project develops.

The initial goal is **not** to create the most complicated state possible, but to create a representation that allows the agent to learn effectively.

---

# Planned Reward System

The reinforcement-learning environment will provide rewards based on gameplay.

An initial reward design may include:

| Event                 |        Reward |
| --------------------- | ------------: |
| Eat normal pellet     |           +10 |
| Eat power pellet      |           +50 |
| Eat ghost             |          +200 |
| Lose a life           |          -500 |
| Game over             |         -1000 |
| Unproductive movement | Small penalty |

The reward system will be experimentally adjusted during training.

The goal is to avoid creating a reward function that teaches the agent unintended behavior.

---

# Learning Experiments

The `lessons/` directory contains small experiments created while learning the concepts used in the project.

These experiments are intentionally simple.

For example, the project has already explored:

```text
Neural Network
     ↓
Forward Pass
     ↓
Prediction
     ↓
Loss
     ↓
Backpropagation
     ↓
Weight Updates
```

and:

```text
Q-Learning
     ↓
State
     ↓
Action
     ↓
Reward
     ↓
Q-value update
```

The purpose is to understand **why the algorithms work**, rather than treating them as black boxes.

---

# Technologies

### Game

* JavaScript
* HTML
* Canvas

### Machine Learning

Planned:

* Python
* NumPy
* PyTorch
* Deep Q-Learning
* Neural Networks
* Replay Buffer

### Development

* Python virtual environment
* VS Code
* Git
* GitHub

---

# Current Status

### Completed

* [x] Set up Python environment
* [x] Learned basic neural-network concepts
* [x] Implemented basic neural-network experiments
* [x] Successfully trained a small network to learn XOR
* [x] Learned reinforcement-learning fundamentals
* [x] Implemented Q-learning from scratch
* [x] Successfully trained a Q-table on a simple environment
* [x] Cloned the browser-based Pac-Man implementation
* [x] Ran Pac-Man locally
* [x] Inspected the game's internal architecture
* [x] Identified Pac-Man's state representation
* [x] Identified ghost state and movement systems
* [x] Identified maze and tile representation
* [x] Added an experimental AI interface
* [x] Successfully controlled Pac-Man programmatically

### In Progress

* [ ] Build Pac-Man state extraction
* [ ] Create a normalized state vector
* [ ] Create a JavaScript ↔ Python communication layer
* [ ] Implement DQN
* [ ] Implement experience replay
* [ ] Implement target network
* [ ] Train the first Pac-Man agent
* [ ] Evaluate agent performance

### Future

* [ ] Improve reward design
* [ ] Compare different state representations
* [ ] Compare DQN configurations
* [ ] Train longer-running agents
* [ ] Experiment with CNN-based visual input
* [ ] Train directly from game pixels
* [ ] Compare the learned agent against the game's existing behavior

---

# Planned Evaluation

The AI won't simply be judged by whether it can move.

We'll eventually track metrics such as:

```text
Average Score
Average Survival Time
Pellets Collected
Ghosts Eaten
Lives Remaining
Episode Length
Training Loss
Average Reward
```

This will allow us to see whether the agent is actually learning.

---

# Why This Project?

This project is primarily a **learning experiment**.

Instead of simply building:

```python
model = SomeRLAlgorithm(...)
```

the goal is to understand the entire process:

```text
Neural Networks
      ↓
Gradient Descent
      ↓
Backpropagation
      ↓
Reinforcement Learning
      ↓
Q-Learning
      ↓
Bellman Equation
      ↓
Deep Q-Network
      ↓
Game Environment
      ↓
Training
      ↓
Learned Behavior
```

Pac-Man provides an interesting environment because the agent has to balance:

* Collecting rewards
* Avoiding ghosts
* Navigating a maze
* Choosing actions at the right time
* Planning ahead
* Learning from failure

---

# Project Status

This project is currently an **experimental educational project** and is under active development.

The DQN agent has not yet been trained to play the full Pac-Man game.

The current focus is building the environment and understanding each component before beginning full-scale training.

---

# Attribution

The browser-based Pac-Man implementation used in this project is based on:

**Alex313031/web-pacman**

Repository:

https://github.com/Alex313031/web-pacman

The original game's license and copyright notices are retained with the game source under:

```text
game/pacman/LICENSE
```

This project does not claim ownership of the original Pac-Man implementation.

The neural-network experiments, reinforcement-learning experiments, AI interface, and future DQN components are being developed as part of this project.

---

# Disclaimer

This project is intended for **education, experimentation, and learning about machine learning and reinforcement learning**.

It is not intended to reproduce or distribute proprietary Pac-Man game software, ROMs, or proprietary assets.

---

## Future Goal

The final target is simple:

```text
          👀 GAME
             ↓
        🧠 NEURAL NETWORK
             ↓
      ┌──────┼──────┐
      ↓      ↓      ↓
     UP    DOWN   LEFT   RIGHT
             ↓
          🟡 PAC-MAN
             ↓
          REWARD
             ↓
        🧠 LEARN
             ↺
```

**Can a neural network learn to play Pac-Man from experience?**

That's what this project is going to find out.
