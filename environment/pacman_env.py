import asyncio
import json

import websockets


class PacmanEnv:

    ACTION_UP = 0
    ACTION_LEFT = 1
    ACTION_DOWN = 2
    ACTION_RIGHT = 3

    def __init__(
        self,
        uri="ws://localhost:8765",
        timeout=10
    ):
        self.uri = uri
        self.timeout = timeout

        self.websocket = None

        self.current_state = None
        self.current_score = 0

    async def connect(self):
        """Connect to the browser Pac-Man game."""

        self.websocket = await websockets.connect(
            self.uri
        )

        print("Connected to Pac-Man environment.")

    async def close(self):
        """Close the WebSocket connection."""

        if self.websocket is not None:

            await self.websocket.close()

            self.websocket = None

    async def reset(self):
        """
        Start a new episode.

        Returns:
            Initial state.
        """

        if self.websocket is None:
            await self.connect()

        await self.websocket.send(
            json.dumps({
                "type": "reset"
            })
        )

        message = await asyncio.wait_for(
            self.websocket.recv(),
            timeout=self.timeout
        )

        data = json.loads(message)

        if data["type"] != "state":
            raise RuntimeError(
                f"Expected state, got {data['type']}"
            )

        self.current_state = data["state"]

        self.current_score = data.get(
            "score",
            0
        )

        return self.current_state

    async def step(self, action):
        """
        Execute one action in Pac-Man.

        Args:
            action:
                0 = UP
                1 = LEFT
                2 = DOWN
                3 = RIGHT

        Returns:
            next_state, reward, done
        """

        if self.websocket is None:
            await self.connect()

        if action not in range(4):
            raise ValueError(
                f"Invalid action: {action}"
            )

        await self.websocket.send(
            json.dumps({
                "type": "action",
                "action": action
            })
        )

        message = await asyncio.wait_for(
            self.websocket.recv(),
            timeout=self.timeout
        )

        data = json.loads(message)

        if data["type"] != "transition":
            raise RuntimeError(
                f"Expected transition, got {data['type']}"
            )

        next_state = data["next_state"]

        reward = data["reward"]

        done = data["done"]

        self.current_state = next_state

        return next_state, reward, done


if __name__ == "__main__":

    async def test():

        env = PacmanEnv()

        try:

            state = await env.reset()

            print("Initial state:")
            print(state)

            next_state, reward, done = await env.step(
                PacmanEnv.ACTION_RIGHT
            )

            print("\nNext state:")
            print(next_state)

            print("\nReward:")
            print(reward)

            print("\nDone:")
            print(done)

        finally:

            await env.close()


    asyncio.run(test())