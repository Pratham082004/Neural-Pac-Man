import random
from collections import deque

import numpy as np


class ReplayBuffer:
    def __init__(self, capacity=100_000):
        self.buffer = deque(maxlen=capacity)

    def push(self, state, action, reward, next_state, done):
        experience = (
            state,
            action,
            reward,
            next_state,
            done,
        )

        self.buffer.append(experience)

    def sample(self, batch_size):
        return random.sample(self.buffer, batch_size)

    def __len__(self):
        return len(self.buffer)


if __name__ == "__main__":

    buffer = ReplayBuffer(capacity=10)

    state = np.zeros(72, dtype=np.float32)
    action = 3
    reward = 10.0
    next_state = np.ones(72, dtype=np.float32)
    done = False

    buffer.push(
        state,
        action,
        reward,
        next_state,
        done,
    )

    print("Buffer size:", len(buffer))

    batch = buffer.sample(1)

    print("Sample:")
    print(batch)
