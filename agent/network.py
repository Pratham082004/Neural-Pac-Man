import torch
import torch.nn as nn

class DQN(nn.Module):

    def __init__(self, state_size=72, action_size=4):
        super().__init__()

        self.network = nn.Sequential(

            nn.Linear(state_size, 128),
            nn.ReLU(),

            nn.Linear(128, 128),
            nn.ReLU(),

            nn.Linear(128, 128),
            nn.ReLU(),

            nn.Linear(128, action_size)
        )

    def forward(self, state):
        return self.network(state)

if __name__ == "__main__":

    model = DQN()

    print(model)

    # Fake Pac-Man state (V3)
    state = torch.randn(1, 72)

    q_values = model(state)

    print("\nInput shape:")
    print(state.shape)

    print("\nQ-values:")
    print(q_values)

    print("\nBest action:")
    print(torch.argmax(q_values, dim=1))