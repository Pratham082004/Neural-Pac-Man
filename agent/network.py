import torch
import torch.nn as nn

class DQN(nn.Module):

    def __init__(self, state_size=26, action_size=4):
        super().__init__()

        self.network = nn.Sequential(

            nn.Linear(state_size, 64),
            nn.ReLU(),

            nn.Linear(64, 64),
            nn.ReLU(),

            nn.Linear(64, action_size)
        )

    def forward(self, state):
        return self.network(state)

if __name__ == "__main__":

    model = DQN()

    print(model)

    # Fake Pac-Man state
    state = torch.randn(1, 26)

    q_values = model(state)

    print("\nInput shape:")
    print(state.shape)

    print("\nQ-values:")
    print(q_values)

    print("\nBest action:")
    print(torch.argmax(q_values, dim=1))