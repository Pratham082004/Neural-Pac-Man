import asyncio
import json
import websockets

HOST = 'localhost'
PORT = 8765

async def handle_connection(websocket):
    print("Pac-Man connected")

    try:
        async for message in websocket:
            data = json.loads(message)

            if data["type"] == "state":
                state = data["state"]
                print("Received state:", state)

                # actions
                # 0 = up
                # 1 = down
                # 2 = left
                # 3 = right
                action = 3

                await websocket.send(json.dumps({"type": "action", "action": action}))
    except websockets.ConnectionClosed:
        print("Pac-Man disconnected")   

async def main():
    print(f"Starting server on {HOST}:{PORT}")

    async with websockets.serve(handle_connection, HOST, PORT):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())