import asyncio
import json
import os
import sys

import torch
import websockets

import agent.dqn as dqn


# ============================================================
# SERVER CONFIG
# ============================================================

HOST = "0.0.0.0"
PORT = 8765

CHECKPOINT_DIR = "checkpoints"
CHECKPOINT_FILE = os.path.join(
    CHECKPOINT_DIR,
    "pacman_dqn_v2.pth"
)

MODE = (
    sys.argv[1].lower()
    if len(sys.argv) > 1
    else "train"
)

if MODE not in ("train", "eval"):
    print("Usage:")
    print("  python server.py train")
    print("  python server.py eval")
    sys.exit(1)


# ============================================================
# CREATE DQN AGENT
# ============================================================

agent = dqn.DQNAgent()


# ============================================================
# EVALUATION STATE
# ============================================================

evaluation_episode = 0
evaluation_steps = 0
evaluation_reward = 0.0
evaluation_finished = False

EVALUATION_EPISODES = 10


# ============================================================
# TRAINING STATISTICS
# ============================================================

episode_number = 0

episode_steps = 0
episode_reward = 0.0

episode_positive_rewards = 0
episode_negative_rewards = 0

episode_max_reward = 0.0
episode_losses = []

best_episode_reward = float("-inf")
best_episode_steps = 0

total_transitions = 0


# ============================================================
# CHECKPOINT
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
            f"[CHECKPOINT] NOT FOUND: {CHECKPOINT_FILE}"
        )

        return False

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

        # Only restore optimizer during training.
        if MODE == "train":
            if "optimizer_state_dict" in checkpoint:
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
        print("=" * 60)
        print("CHECKPOINT LOADED")
        print("-" * 60)
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
            f"Saved epsilon:     {agent.epsilon:.4f}"
        )
        print(
            f"Best reward:       {best_episode_reward:.2f}"
        )
        print(
            f"Best steps:        {best_episode_steps}"
        )
        print("=" * 60)
        print()

        return True

    except Exception as e:

        print(
            "[CHECKPOINT] Failed to load:"
        )

        print(e)

        return False


# ============================================================
# TRAINING RESET
# ============================================================

def reset_training_episode():

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
# FINISH TRAINING EPISODE
# ============================================================

def finish_training_episode():

    global episode_number
    global best_episode_reward
    global best_episode_steps

    episode_number += 1

    average_loss = (
        sum(episode_losses) / len(episode_losses)
        if episode_losses
        else 0.0
    )

    new_best_reward = False
    new_best_steps = False

    if episode_reward > best_episode_reward:

        best_episode_reward = episode_reward
        new_best_reward = True

    if episode_steps > best_episode_steps:

        best_episode_steps = episode_steps
        new_best_steps = True

    print()
    print("=" * 60)

    print(
        f"Episode {episode_number} finished"
    )

    print("-" * 60)

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

    print("=" * 60)
    print()

    save_checkpoint()

    reset_training_episode()


# ============================================================
# EVALUATION RESET
# ============================================================

def reset_evaluation_episode():

    global evaluation_steps
    global evaluation_reward
    global evaluation_finished

    evaluation_steps = 0
    evaluation_reward = 0.0
    evaluation_finished = False


# ============================================================
# FINISH EVALUATION EPISODE
# ============================================================

def finish_evaluation_episode():

    global evaluation_episode
    global evaluation_finished

    evaluation_episode += 1

    print()
    print("=" * 60)

    print(
        f"EVALUATION EPISODE {evaluation_episode}/{EVALUATION_EPISODES}"
    )

    print("-" * 60)

    print(
        f"Steps:              {evaluation_steps}"
    )

    print(
        f"Total reward:       {evaluation_reward:.2f}"
    )

    print(
        f"Epsilon:            {agent.epsilon:.4f}"
    )

    print("=" * 60)
    print()

    evaluation_finished = True


# ============================================================
# FINAL EVALUATION SUMMARY
# ============================================================

evaluation_results = []


def print_evaluation_summary():

    if not evaluation_results:
        return

    rewards = [
        result["reward"]
        for result in evaluation_results
    ]

    steps = [
        result["steps"]
        for result in evaluation_results
    ]

    average_reward = sum(rewards) / len(rewards)
    average_steps = sum(steps) / len(steps)

    best_reward = max(rewards)
    best_steps = max(steps)

    worst_reward = min(rewards)

    print()
    print()
    print("#" * 60)
    print("FINAL EVALUATION RESULTS")
    print("#" * 60)

    print(
        f"Games evaluated:    {len(evaluation_results)}"
    )

    print(
        f"Average reward:     {average_reward:.2f}"
    )

    print(
        f"Best reward:        {best_reward:.2f}"
    )

    print(
        f"Worst reward:       {worst_reward:.2f}"
    )

    print(
        f"Average steps:      {average_steps:.2f}"
    )

    print(
        f"Best survival:      {best_steps}"
    )

    print("-" * 60)

    for result in evaluation_results:

        print(
            f"Game {result['episode']:02d} | "
            f"Steps: {result['steps']:4d} | "
            f"Reward: {result['reward']:8.2f}"
        )

    print("#" * 60)
    print()


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

    global evaluation_steps
    global evaluation_reward
    global evaluation_finished

    print()
    print("Pac-Man connected")

    if MODE == "train":

        print(
            "[MODE] TRAINING"
        )

    else:

        print(
            "[MODE] EVALUATION"
        )

        print(
            "[EVAL] Epsilon forced to 0.0"
        )

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

                if MODE == "eval":

                    # Completely deterministic evaluation.
                    action = agent.choose_action(
                        state
                    )

                else:

                    # Normal DQN training exploration.
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
            # BROWSER LOG
            # ==================================================

            elif message_type == "log":

                level = data.get(
                    "level",
                    "info"
                )

                message_items = data.get(
                    "message",
                    []
                )

                message_text = " ".join(
                    str(item)
                    for item in message_items
                )

                if level == "warn":

                    print(
                        f"[BROWSER WARN] {message_text}"
                    )

                elif level == "error":

                    print(
                        f"[BROWSER ERROR] {message_text}"
                    )

                else:

                    print(
                        f"[BROWSER] {message_text}"
                    )

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

                # ==================================================
                # EVALUATION MODE
                # ==================================================

                if MODE == "eval":

                    evaluation_steps += 1

                    evaluation_reward += reward

                    print(
                        f"[EVAL] "
                        f"step={evaluation_steps} "
                        f"reward={reward:.2f} "
                        f"done={done}"
                    )

                    if done:

                        evaluation_results.append({
                            "episode":
                                evaluation_episode + 1,

                            "steps":
                                evaluation_steps,

                            "reward":
                                evaluation_reward
                        })

                        finish_evaluation_episode()

                        if evaluation_episode >= EVALUATION_EPISODES:

                            print_evaluation_summary()

                            print(
                                "[EVAL] Evaluation complete."
                            )

                            print(
                                "[EVAL] Close the server with CTRL+C."
                            )

                            return

                        reset_evaluation_episode()

                        print(
                            "[EVAL] Starting next evaluation episode..."
                        )

                        await websocket.send(
                            json.dumps({
                                "type": "reset"
                            })
                        )

                    continue

                # ==================================================
                # TRAINING MODE
                # ==================================================

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

                # --------------------------------------------------
                # Store experience
                # --------------------------------------------------

                agent.remember(
                    state,
                    action,
                    reward,
                    next_state,
                    done
                )

                # --------------------------------------------------
                # Train
                # --------------------------------------------------

                loss = agent.train_step()

                if loss is not None:

                    episode_losses.append(
                        loss
                    )

                    print(
                        f"Loss: {loss:.6f}"
                    )

                print(
                    f"[SERVER] "
                    f"Transition received: "
                    f"done={done} "
                    f"reward={reward:.2f} "
                    f"total_transitions={total_transitions}"
                )

                # --------------------------------------------------
                # Episode finished
                # --------------------------------------------------

                if done:

                    print(
                        "[SERVER] Terminal transition received."
                    )

                    finish_training_episode()

                    print(
                        "[SERVER] Sending automatic reset to browser."
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

                if MODE == "train":

                    reset_training_episode()

                else:

                    reset_evaluation_episode()

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

    print()
    print("=" * 60)

    if MODE == "train":

        print(
            "NEURAL PAC-MAN — TRAINING MODE"
        )

    else:

        print(
            "NEURAL PAC-MAN — EVALUATION MODE"
        )

    print("=" * 60)

    # ----------------------------------------------------------
    # Load checkpoint
    # ----------------------------------------------------------

    loaded = load_checkpoint()

    if not loaded:

        if MODE == "eval":
            print(
                "[SERVER] Cannot evaluate without checkpoint."
            )
            return
            
        print(
            "[SERVER] Checkpoint not found. Starting training from scratch."
        )

    # ----------------------------------------------------------
    # Evaluation configuration
    # ----------------------------------------------------------

    if MODE == "eval":

        agent.epsilon = 0.0

        agent.model.eval()

        agent.target_model.eval()

        print()
        print(
            "🔥 EVALUATION CONFIGURATION"
        )
        print(
            "Epsilon:            0.0000"
        )
        print(
            "Training:           DISABLED"
        )
        print(
            "Replay memory:      DISABLED"
        )
        print(
            "Optimizer:          DISABLED"
        )
        print(
            f"Episodes:           {EVALUATION_EPISODES}"
        )
        print()

    else:

        agent.model.train()

    # ----------------------------------------------------------
    # Start WebSocket
    # ----------------------------------------------------------

    async with websockets.serve(
        handle_connection,
        HOST,
        PORT
    ):

        print(
            f"WebSocket server running at "
            f"ws://{HOST}:{PORT}"
        )

        print()

        await asyncio.Future()


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    asyncio.run(
        main()
    )