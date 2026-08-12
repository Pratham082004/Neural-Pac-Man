import asyncio
import json
import os

import torch
import websockets

import agent.dqn as dqn


# ============================================================
# SERVER CONFIG
# ============================================================

HOST = "localhost"
PORT = 8765

CHECKPOINT_DIR = "checkpoints"
CHECKPOINT_FILE = os.path.join(
    CHECKPOINT_DIR,
    "pacman_dqn.pth"
)


# ============================================================
# CREATE DQN AGENT
# ============================================================

agent = dqn.DQNAgent()


# ============================================================
# EPISODE STATISTICS
# ============================================================

episode_number = 0

episode_steps = 0
episode_reward = 0.0

episode_positive_rewards = 0
episode_negative_rewards = 0

episode_max_reward = 0.0

episode_losses = []


# ============================================================
# GLOBAL TRAINING STATISTICS
# ============================================================

best_episode_reward = float("-inf")
best_episode_steps = 0

total_transitions = 0


# ============================================================
# CHECKPOINT FUNCTIONS
# ============================================================

def save_checkpoint():

    os.makedirs(
        CHECKPOINT_DIR,
        exist_ok=True
    )

    checkpoint = {
        "model_state_dict":
            agent.model.state_dict(),

        "target_model_state_dict":
            agent.target_model.state_dict(),

        "optimizer_state_dict":
            agent.optimizer.state_dict(),

        "epsilon":
            agent.epsilon,

        "training_steps":
            agent.training_steps,

        "episode_number":
            episode_number,

        "best_episode_reward":
            best_episode_reward,

        "best_episode_steps":
            best_episode_steps,

        "total_transitions":
            total_transitions
    }

    torch.save(
        checkpoint,
        CHECKPOINT_FILE
    )

    print(
        f"[CHECKPOINT] Saved -> {CHECKPOINT_FILE}"
    )


def load_checkpoint():

    global episode_number
    global best_episode_reward
    global best_episode_steps
    global total_transitions

    if not os.path.exists(CHECKPOINT_FILE):

        print(
            "[CHECKPOINT] No checkpoint found."
        )

        print(
            "[CHECKPOINT] Starting training from scratch."
        )

        return

    try:

        checkpoint = torch.load(
            CHECKPOINT_FILE,
            map_location="cpu"
        )

        agent.model.load_state_dict(
            checkpoint["model_state_dict"]
        )

        agent.target_model.load_state_dict(
            checkpoint["target_model_state_dict"]
        )

        agent.optimizer.load_state_dict(
            checkpoint["optimizer_state_dict"]
        )

        agent.epsilon = checkpoint.get(
            "epsilon",
            agent.epsilon
        )

        agent.training_steps = checkpoint.get(
            "training_steps",
            agent.training_steps
        )

        episode_number = checkpoint.get(
            "episode_number",
            0
        )

        best_episode_reward = checkpoint.get(
            "best_episode_reward",
            float("-inf")
        )

        best_episode_steps = checkpoint.get(
            "best_episode_steps",
            0
        )

        total_transitions = checkpoint.get(
            "total_transitions",
            0
        )

        print()
        print("=" * 55)
        print("CHECKPOINT LOADED")
        print("-" * 55)
        print(
            f"Episodes:          {episode_number}"
        )
        print(
            f"Training steps:    {agent.training_steps}"
        )
        print(
            f"Transitions:       {total_transitions}"
        )
        print(
            f"Epsilon:           {agent.epsilon:.4f}"
        )
        print(
            f"Best reward:       {best_episode_reward:.2f}"
        )
        print(
            f"Best steps:        {best_episode_steps}"
        )
        print("=" * 55)
        print()

    except Exception as e:

        print(
            "[CHECKPOINT] Failed to load checkpoint:"
        )

        print(e)

        print(
            "[CHECKPOINT] Starting from current agent state."
        )


# ============================================================
# RESET EPISODE STATISTICS
# ============================================================

def reset_episode_statistics():

    global episode_steps
    global episode_reward
    global episode_positive_rewards
    global episode_negative_rewards
    global episode_max_reward
    global episode_losses

    episode_steps = 0
    episode_reward = 0.0

    episode_positive_rewards = 0
    episode_negative_rewards = 0

    episode_max_reward = 0.0

    episode_losses = []


# ============================================================
# PRINT EPISODE SUMMARY
# ============================================================

def finish_episode():

    global episode_number
    global best_episode_reward
    global best_episode_steps

    episode_number += 1

    average_loss = (
        sum(episode_losses) / len(episode_losses)
        if episode_losses
        else 0.0
    )

    # --------------------------------------------------------
    # Best reward
    # --------------------------------------------------------

    new_best_reward = False

    if episode_reward > best_episode_reward:

        best_episode_reward = episode_reward
        new_best_reward = True

    # --------------------------------------------------------
    # Best survival
    # --------------------------------------------------------

    new_best_steps = False

    if episode_steps > best_episode_steps:

        best_episode_steps = episode_steps
        new_best_steps = True

    # --------------------------------------------------------
    # Episode output
    # --------------------------------------------------------

    print()

    print("=" * 55)

    print(
        f"Episode {episode_number} finished"
    )

    print("-" * 55)

    print(
        f"Steps:              {episode_steps}"
    )

    print(
        f"Total reward:       {episode_reward:.2f}"
    )

    print(
        f"Positive rewards:   {episode_positive_rewards}"
    )

    print(
        f"Negative rewards:   {episode_negative_rewards}"
    )

    print(
        f"Max reward:         {episode_max_reward:.2f}"
    )

    print(
        f"Average loss:       {average_loss:.6f}"
    )

    print(
        f"Epsilon:            {agent.epsilon:.4f}"
    )

    print(
        f"Best reward:        {best_episode_reward:.2f}"
    )

    print(
        f"Best steps:         {best_episode_steps}"
    )

    print(
        f"Training steps:     {agent.training_steps}"
    )

    print(
        f"Replay memory:      {len(agent.memory)}"
    )

    if new_best_reward:

        print(
            "🔥 NEW BEST REWARD!"
        )

    if new_best_steps:

        print(
            "🏆 NEW BEST SURVIVAL!"
        )

    print("=" * 55)

    print()

    # --------------------------------------------------------
    # Save checkpoint
    # --------------------------------------------------------

    save_checkpoint()

    # --------------------------------------------------------
    # Reset episode statistics
    # --------------------------------------------------------

    reset_episode_statistics()


# ============================================================
# WEBSOCKET CONNECTION
# ============================================================

async def handle_connection(websocket):

    global episode_steps
    global episode_reward
    global episode_positive_rewards
    global episode_negative_rewards
    global episode_max_reward
    global episode_losses
    global total_transitions

    print()
    print("Pac-Man connected")

    try:

        async for message in websocket:

            data = json.loads(message)

            message_type = data.get(
                "type"
            )

            # ==================================================
            # STATE
            # ==================================================

            if message_type == "state":

                state = data["state"]

                # ------------------------------------------------
                # Select action using DQN
                # ------------------------------------------------

                action = agent.choose_action(
                    state
                )

                await websocket.send(
                    json.dumps({
                        "type": "action",
                        "action": action
                    })
                )

            # ==================================================
            # LOG
            # ==================================================

            elif message_type == "log":

                level = data.get("level", "info")
                message_items = data.get("message", [])
                message_text = " ".join(
                    str(item) for item in message_items
                )

                if level == "warn":
                    print(f"[BROWSER WARN] {message_text}")
                elif level == "error":
                    print(f"[BROWSER ERROR] {message_text}")
                else:
                    print(f"[BROWSER] {message_text}")

            # ==================================================
            # TRANSITION
            # ==================================================

            elif message_type == "transition":

                state = data["state"]

                action = data["action"]

                next_state = data["next_state"]

                reward = float(
                    data["reward"]
                )

                done = bool(
                    data["done"]
                )

                # ------------------------------------------------
                # Episode statistics
                # ------------------------------------------------

                episode_steps += 1

                episode_reward += reward

                total_transitions += 1

                if reward > 0:

                    episode_positive_rewards += 1

                elif reward < 0:

                    episode_negative_rewards += 1

                episode_max_reward = max(
                    episode_max_reward,
                    reward
                )

                # ------------------------------------------------
                # Store experience
                # ------------------------------------------------

                agent.remember(
                    state,
                    action,
                    reward,
                    next_state,
                    done
                )

                # ------------------------------------------------
                # Train
                # ------------------------------------------------

                loss = agent.train_step()

                if loss is not None:

                    episode_losses.append(
                        loss
                    )

                    print(
                        f"Loss: {loss:.6f}"
                    )

                print(
                    f"[SERVER] Transition received: done={done} reward={reward:.2f} total_transitions={total_transitions}"
                )

                # ------------------------------------------------
                # Episode finished
                # ------------------------------------------------

                if done:

                    print(
                        "[SERVER] Terminal transition received, finishing episode"
                    )

                    finish_episode()

                    print(
                        "[SERVER] Sending automatic reset to browser"
                    )

                    await websocket.send(
                        json.dumps({
                            "type": "reset"
                        })
                    )

            # ==================================================
            # RESET
            # ==================================================

            elif message_type == "reset":

                print(
                    "[SERVER] Reset requested"
                )

                reset_episode_statistics()

                await websocket.send(
                    json.dumps({
                        "type": "reset"
                    })
                )

    except websockets.exceptions.ConnectionClosed:

        print(
            "Pac-Man disconnected"
        )

    except Exception as e:

        print(
            "[SERVER ERROR]"
        )

        print(e)


# ============================================================
# MAIN
# ============================================================

async def main():

    print(
        f"Starting server on {HOST}:{PORT}"
    )

    # --------------------------------------------------------
    # Load previous training
    # --------------------------------------------------------

    load_checkpoint()

    # --------------------------------------------------------
    # Start WebSocket server
    # --------------------------------------------------------

    async with websockets.serve(
        handle_connection,
        HOST,
        PORT
    ):

        print(
            f"WebSocket server running at "
            f"ws://{HOST}:{PORT}"
        )

        await asyncio.Future()


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    asyncio.run(
        main()
    )
