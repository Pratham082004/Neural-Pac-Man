import random

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

from .network import DQN
from .replay_buffer import ReplayBuffer


class DQNAgent:

    def __init__(
        self,
        state_size=26,
        action_size=4,
        gamma=0.99,
        learning_rate=0.001,
        buffer_size=100_000,
        batch_size=64
    ):

        self.state_size = state_size
        self.action_size = action_size

        # --------------------------------------------------
        # RL parameters
        # --------------------------------------------------

        self.gamma = gamma

        # Exploration
        self.epsilon = 1.0
        self.epsilon_min = 0.05

        # Epsilon will decay over TRAINING STEPS,
        # not exponentially on every train_step().
        self.epsilon_decay_steps = 50_000

        # --------------------------------------------------
        # Training
        # --------------------------------------------------

        self.batch_size = batch_size

        # --------------------------------------------------
        # Main network
        # --------------------------------------------------

        self.model = DQN(
            state_size=state_size,
            action_size=action_size
        )

        # --------------------------------------------------
        # Target network
        # --------------------------------------------------

        self.target_model = DQN(
            state_size=state_size,
            action_size=action_size
        )

        self.target_model.load_state_dict(
            self.model.state_dict()
        )

        self.target_model.eval()

        # Update target network periodically
        self.target_update_frequency = 1000

        self.training_steps = 0

        # --------------------------------------------------
        # Optimizer
        # --------------------------------------------------

        self.optimizer = optim.Adam(
            self.model.parameters(),
            lr=learning_rate
        )

        # Huber loss is more stable for DQN
        self.loss_fn = nn.SmoothL1Loss()

        # --------------------------------------------------
        # Replay buffer
        # --------------------------------------------------

        self.memory = ReplayBuffer(buffer_size)

    # ======================================================
    # ACTION SELECTION
    # ======================================================

    def choose_action(self, state):

        # ----------------------------------------------
        # Exploration
        # ----------------------------------------------

        if random.random() < self.epsilon:

            return random.randrange(
                self.action_size
            )

        # ----------------------------------------------
        # Exploitation
        # ----------------------------------------------

        state_tensor = torch.tensor(
            state,
            dtype=torch.float32
        ).unsqueeze(0)

        with torch.no_grad():

            q_values = self.model(
                state_tensor
            )

        return torch.argmax(
            q_values,
            dim=1
        ).item()

    # ======================================================
    # REPLAY MEMORY
    # ======================================================

    def remember(
        self,
        state,
        action,
        reward,
        next_state,
        done
    ):

        self.memory.push(
            state,
            action,
            reward,
            next_state,
            done
        )

    # ======================================================
    # EPSILON UPDATE
    # ======================================================

    def update_epsilon(self):

        if self.training_steps >= self.epsilon_decay_steps:

            self.epsilon = self.epsilon_min

            return

        progress = (
            self.training_steps
            / self.epsilon_decay_steps
        )

        self.epsilon = (
            1.0
            - progress
            * (1.0 - self.epsilon_min)
        )

        self.epsilon = max(
            self.epsilon,
            self.epsilon_min
        )

    # ======================================================
    # TRAINING
    # ======================================================

    def train_step(self):

        # --------------------------------------------------
        # Wait until replay buffer has enough samples
        # --------------------------------------------------

        if len(self.memory) < self.batch_size:

            return None

        # --------------------------------------------------
        # Sample experience
        # --------------------------------------------------

        batch = self.memory.sample(
            self.batch_size
        )

        states, actions, rewards, next_states, dones = zip(
            *batch
        )

        states = torch.tensor(
            np.array(states),
            dtype=torch.float32
        )

        actions = torch.tensor(
            actions,
            dtype=torch.long
        )

        rewards = torch.tensor(
            rewards,
            dtype=torch.float32
        )

        next_states = torch.tensor(
            np.array(next_states),
            dtype=torch.float32
        )

        dones = torch.tensor(
            dones,
            dtype=torch.float32
        )

        # ==================================================
        # CURRENT Q VALUES
        # ==================================================

        current_q_values = self.model(
            states
        )

        current_q_values = current_q_values.gather(
            1,
            actions.unsqueeze(1)
        ).squeeze(1)

        # ==================================================
        # DOUBLE DQN TARGET
        # ==================================================

        with torch.no_grad():

            # Main network chooses the best next action
            next_actions = self.model(
                next_states
            ).argmax(
                dim=1,
                keepdim=True
            )

            # Target network evaluates that action
            next_q_values = self.target_model(
                next_states
            ).gather(
                1,
                next_actions
            ).squeeze(1)

        # ==================================================
        # BELLMAN TARGET
        # ==================================================

        targets = rewards + (
            self.gamma
            * next_q_values
            * (1 - dones)
        )

        # ==================================================
        # LOSS
        # ==================================================

        loss = self.loss_fn(
            current_q_values,
            targets
        )

        # ==================================================
        # BACKPROPAGATION
        # ==================================================

        self.optimizer.zero_grad()

        loss.backward()

        # Prevent exploding gradients
        torch.nn.utils.clip_grad_norm_(
            self.model.parameters(),
            max_norm=1.0
        )

        self.optimizer.step()

        self.training_steps += 1

        # ==================================================
        # UPDATE TARGET NETWORK
        # ==================================================

        if (
            self.training_steps
            % self.target_update_frequency
            == 0
        ):

            self.target_model.load_state_dict(
                self.model.state_dict()
            )

            print(
                "[DQN] Target network updated."
            )

        # ==================================================
        # UPDATE EPSILON
        # ==================================================

        self.update_epsilon()

        return loss.item()


# ==========================================================
# BASIC TEST
# ==========================================================

if __name__ == "__main__":

    agent = DQNAgent()

    print()
    print("=" * 50)
    print("DQN Agent Test")
    print("=" * 50)

    print(
        "State size:",
        agent.state_size
    )

    print(
        "Action size:",
        agent.action_size
    )

    print(
        "Initial epsilon:",
        agent.epsilon
    )

    print(
        "Replay buffer:",
        len(agent.memory)
    )

    # --------------------------------------------------
    # Create first fake experience
    # --------------------------------------------------

    state = np.random.rand(26)

    next_state = np.random.rand(26)

    agent.remember(
        state=state,
        action=3,
        reward=10,
        next_state=next_state,
        done=False
    )

    # --------------------------------------------------
    # Fill replay buffer
    # --------------------------------------------------

    for _ in range(63):

        agent.remember(
            state=np.random.rand(26),
            action=random.randrange(4),
            reward=random.choice(
                [-1, 0, 1, 5, 10]
            ),
            next_state=np.random.rand(26),
            done=False
        )

    print(
        "Replay buffer before training:",
        len(agent.memory)
    )

    # --------------------------------------------------
    # Train
    # --------------------------------------------------

    loss = agent.train_step()

    print(
        "Training loss:",
        loss
    )

    print(
        "Training steps:",
        agent.training_steps
    )

    print(
        "Epsilon after training:",
        agent.epsilon
    )

    # --------------------------------------------------
    # Test action selection
    # --------------------------------------------------

    test_state = np.random.rand(26)

    action = agent.choose_action(
        test_state
    )

    print(
        "Test action:",
        action
    )

    print("=" * 50)