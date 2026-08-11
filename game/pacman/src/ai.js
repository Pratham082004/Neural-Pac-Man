//////////////////////////////////////////////////////////////////////////////////////
// Neural Pac-Man AI Interface
// basically orchestrates the pacman object to move in a certain direction

var neuralAI = {

    setDirection: function(dirEnum) {
        if (!pacman)
            return;

        pacman.setInputDir(dirEnum);
    },

    stop: function() {
        if (!pacman)
            return;

        pacman.clearInputDir();
    },

    up: function() {
        this.setDirection(DIR_UP);
    },

    left: function() {
        this.setDirection(DIR_LEFT);
    },

    down: function() {
        this.setDirection(DIR_DOWN);
    },

    right: function() {
        this.setDirection(DIR_RIGHT);
    },
    // gets a JSON representation of the current game state for use in neural networks
    getState: function() {

        if (!pacman)
            return null;

        return {
            pacman: {
                pixelX: pacman.pixel.x,
                pixelY: pacman.pixel.y,
                tileX: pacman.tile.x,
                tileY: pacman.tile.y,
                direction: pacman.dirEnum,
                nextDirection: pacman.nextDirEnum,
                stopped: pacman.stopped
            },

            ghosts: ghosts.map(function(ghost) {
                return {
                    name: ghost.name,
                    tileX: ghost.tile.x,
                    tileY: ghost.tile.y,
                    direction: ghost.dirEnum,
                    mode: ghost.mode,
                    scared: ghost.scared
                };
            })
        };
    },
    // gets a vector representation of the current game state for use in neural networks
    getStateVector: function() {

    if (!pacman)
        return null;

    var state = [];

    // Pac-Man position

    state.push(pacman.tile.x);
    state.push(pacman.tile.y);

    // current direction
    state.push(
        pacman.dirEnum === DIR_UP ? 1 : 0
    );

    state.push(
        pacman.dirEnum === DIR_DOWN ? 1 : 0
    );

    state.push(
        pacman.dirEnum === DIR_LEFT ? 1 : 0
    );

    state.push(
        pacman.dirEnum === DIR_RIGHT ? 1 : 0
    );

    // movement directions

    var openTiles = getOpenTiles(
        pacman.tile,
        pacman.dirEnum
    );

    state.push(openTiles[DIR_UP] ? 1 : 0);
    state.push(openTiles[DIR_DOWN] ? 1 : 0);
    state.push(openTiles[DIR_LEFT] ? 1 : 0);
    state.push(openTiles[DIR_RIGHT] ? 1 : 0);

    // ghost information

    ghosts.forEach(function(ghost) {

        var dx = ghost.tile.x - pacman.tile.x;
        var dy = ghost.tile.y - pacman.tile.y;

        var distance = Math.sqrt(
            dx * dx + dy * dy
        );

        // approximate distances
        distance = Math.min(distance / 30, 1);

        state.push(dx / 30);
        state.push(dy / 30);
        state.push(distance);

        state.push(ghost.scared ? 1 : 0);
    });

    return state;
    },

    //websockets connection
    socket: null,

    connect: function() {

        this.socket = new WebSocket("ws://localhost:8765");

        this.socket.onopen = function() {
            console.log("Connected to Python AI");
        };

        this.socket.onmessage = function(event) {

            var message = JSON.parse(event.data);

            if (message.type === "action") {

                var action = message.action;

                if (action === 0)
                    neuralAI.up();

                else if (action === 1)
                    neuralAI.left();

                else if (action === 2)
                    neuralAI.down();

                else if (action === 3)
                    neuralAI.right();
            }
        };

        this.socket.onclose = function() {
            console.log("Disconnected from Python AI");
        };
    },

    // sends the current game state to the Python AI server
    sendState: function() {

        if (!this.socket ||
            this.socket.readyState !== WebSocket.OPEN) {
            return;
        }

        var state = this.getStateVector();

        this.socket.send(
            JSON.stringify({
                type: "state",
                state: state
            })
        );
    }
};