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

        self.gamma = gamma

        self.epsilon = 1.0
        self.epsilon_min = 0.05
        self.epsilon_decay = 0.9995

        self.batch_size = batch_size

        self.model = DQN(
            state_size=state_size,
            action_size=action_size
        )

        self.target_model = DQN(
            state_size=state_size,
            action_size=action_size
        )

        self.target_model.load_state_dict(
            self.model.state_dict()
        )

        self.target_model.eval()

        self.target_update_frequency = 1000
        self.training_steps = 0

        self.optimizer = optim.Adam(
            self.model.parameters(),
            lr=learning_rate
        )

        self.loss_fn = nn.SmoothL1Loss()

        self.memory = ReplayBuffer(buffer_size)

    def choose_action(self, state):

        if random.random() < self.epsilon:
            return random.randrange(self.action_size)

        state_tensor = torch.tensor(
            state,
            dtype=torch.float32
        ).unsqueeze(0)

        with torch.no_grad():

            q_values = self.model(state_tensor)

        return torch.argmax(
            q_values,
            dim=1
        ).item()

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

    def train_step(self):

        if len(self.memory) < self.batch_size:
            return None

        batch = self.memory.sample(
            self.batch_size
        )

        states, actions, rewards, next_states, dones = zip(*batch)

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

        current_q_values = self.model(states)

        current_q_values = current_q_values.gather(
            1,
            actions.unsqueeze(1)
        ).squeeze(1)

        with torch.no_grad():

            next_q_values = self.target_model(
                next_states
            )

            max_next_q_values = next_q_values.max(
                dim=1
            ).values

        targets = rewards + (
            self.gamma
            * max_next_q_values
            * (1 - dones)
        )

        loss = self.loss_fn(
            current_q_values,
            targets
        )

        self.optimizer.zero_grad()

        loss.backward()

        torch.nn.utils.clip_grad_norm_(
            self.model.parameters(),
            max_norm=1.0
        )

        self.optimizer.step()

        self.training_steps += 1

        if self.training_steps % self.target_update_frequency == 0:

            self.target_model.load_state_dict(
                self.model.state_dict()
            )

            print("Target network updated.")

        if self.epsilon > self.epsilon_min:

            self.epsilon *= self.epsilon_decay

            self.epsilon = max(
                self.epsilon,
                self.epsilon_min
            )

        return loss.item()


if __name__ == "__main__":

    agent = DQNAgent()

    print("DQN Agent created.")

    print(
        "Epsilon:",
        agent.epsilon
    )

    print(
        "Replay buffer:",
        len(agent.memory)
    )

    state = np.random.rand(26)

    next_state = np.random.rand(26)

    agent.remember(
        state=state,
        action=3,
        reward=10,
        next_state=next_state,
        done=False
    )

    print(
        "Replay buffer after experience:",
        len(agent.memory)
    )

    for _ in range(63):

        agent.remember(
            state=np.random.rand(26),
            action=random.randrange(4),
            reward=random.choice([-1, 0, 1, 10]),
            next_state=np.random.rand(26),
            done=False
        )

    print(
        "Replay buffer before training:",
        len(agent.memory)
    )

    loss = agent.train_step()

    print(
        "Training loss:",
        loss
    )

    print(
        "Epsilon after training:",
        agent.epsilon
    )