var neuralAI = {

    socket: null,

    previousScore: 0,

    waitingForReset: false,
    waitingForPlayable: false,
    transitionPending: false,
    terminalSent: false,

    lastState: null,
    lastAction: null,

    playableTimer: null,
    deathTimer: null,

    MAX_WAIT_ATTEMPTS: 100,
    WAIT_INTERVAL: 50,

    visitedTiles: [],
    VISITED_TILES_MAX: 15,
    stepsSinceLastPellet: 0,

    bfsPelletDistance: function (startTile, dirEnum) {

        if (
            typeof map === "undefined" ||
            !map ||
            !map.currentTiles ||
            typeof getOpenTiles !== "function"
        ) {
            return 1.0;
        }

        var queue = [];
        var visited = {};

        var dx = 0;
        var dy = 0;

        if (dirEnum === DIR_UP) dy = -1;
        else if (dirEnum === DIR_DOWN) dy = 1;
        else if (dirEnum === DIR_LEFT) dx = -1;
        else if (dirEnum === DIR_RIGHT) dx = 1;

        var firstX = startTile.x + dx;
        var firstY = startTile.y + dy;

        if (
            firstX < 0 || firstX >= map.numCols ||
            firstY < 0 || firstY >= map.numRows
        ) {
            return 1.0;
        }

        var firstIndex = firstY * map.numCols + firstX;
        var firstTile = map.currentTiles[firstIndex];

        if (
            firstTile === "|" ||
            firstTile === "-" ||
            firstTile === "_"
        ) {
            return 1.0;
        }

        queue.push({ x: firstX, y: firstY, dist: 1 });
        visited[firstX + "," + firstY] = true;

        var maxSearch = 15;

        while (queue.length > 0 && maxSearch > 0) {

            maxSearch--;
            var current = queue.shift();

            var idx = current.y * map.numCols + current.x;
            var tile = map.currentTiles[idx];

            if (tile === "." || tile === "o") {
                return Math.min(current.dist / 15.0, 1.0);
            }

            var neighbors = [
                { x: current.x, y: current.y - 1 },
                { x: current.x, y: current.y + 1 },
                { x: current.x - 1, y: current.y },
                { x: current.x + 1, y: current.y }
            ];

            for (var n = 0; n < neighbors.length; n++) {

                var nx = neighbors[n].x;
                var ny = neighbors[n].y;
                var key = nx + "," + ny;

                if (
                    nx < 0 || nx >= map.numCols ||
                    ny < 0 || ny >= map.numRows ||
                    visited[key]
                ) {
                    continue;
                }

                var nIdx = ny * map.numCols + nx;
                var nTile = map.currentTiles[nIdx];

                if (
                    nTile !== "|" &&
                    nTile !== "-" &&
                    nTile !== "_"
                ) {
                    visited[key] = true;
                    queue.push({ x: nx, y: ny, dist: current.dist + 1 });
                }
            }
        }

        return 1.0;
    },

    isCorridorOrDeadEnd: function (startTile, dirEnum) {

        if (
            typeof map === "undefined" ||
            !map ||
            !map.currentTiles
        ) {
            return 0;
        }

        var dx = 0;
        var dy = 0;

        if (dirEnum === DIR_UP) dy = -1;
        else if (dirEnum === DIR_DOWN) dy = 1;
        else if (dirEnum === DIR_LEFT) dx = -1;
        else if (dirEnum === DIR_RIGHT) dx = 1;

        var cx = startTile.x + dx;
        var cy = startTile.y + dy;

        var steps = 0;
        var openExits = 0;

        for (var step = 0; step < 5; step++) {

            if (
                cx < 0 || cx >= map.numCols ||
                cy < 0 || cy >= map.numRows
            ) {
                break;
            }

            var idx = cy * map.numCols + cx;
            var tile = map.currentTiles[idx];

            if (
                tile === "|" ||
                tile === "-" ||
                tile === "_"
            ) {
                break;
            }

            steps++;

            var perpDirs;
            if (dx !== 0) {
                perpDirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }];
            } else {
                perpDirs = [{ x: -1, y: 0 }, { x: 1, y: 0 }];
            }

            for (var p = 0; p < perpDirs.length; p++) {
                var px = cx + perpDirs[p].x;
                var py = cy + perpDirs[p].y;

                if (
                    px >= 0 && px < map.numCols &&
                    py >= 0 && py < map.numRows
                ) {
                    var pIdx = py * map.numCols + px;
                    var pTile = map.currentTiles[pIdx];

                    if (
                        pTile !== "|" &&
                        pTile !== "-" &&
                        pTile !== "_"
                    ) {
                        openExits++;
                    }
                }
            }

            cx += dx;
            cy += dy;
        }

        if (steps === 0) {
            return 1.0;
        }

        return Math.max(0, 1.0 - (openExits / (steps * 2.0)));
    },

    resetTracking: function () {
        this.visitedTiles = [];
        this.stepsSinceLastPellet = 0;
    },

    setDirection: function (dirEnum) {
        if (!pacman) return;
        pacman.setInputDir(dirEnum);
    },

    stop: function () {
        if (!pacman) return;
        pacman.clearInputDir();
    },

    up: function () {
        this.setDirection(DIR_UP);
    },

    left: function () {
        this.setDirection(DIR_LEFT);
    },

    down: function () {
        this.setDirection(DIR_DOWN);
    },

    right: function () {
        this.setDirection(DIR_RIGHT);
    },

    getState: function () {

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

            ghosts: ghosts.map(function (ghost) {

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

    getGameState: function () {
        if (typeof window !== "undefined" && typeof window.state !== "undefined") {
            return window.state;
        }
        if (typeof state !== "undefined") return state;
        return undefined;
    },

    getPlayState: function () {
        if (typeof window !== "undefined" && typeof window.playState !== "undefined") {
            return window.playState;
        }
        if (typeof playState !== "undefined") return playState;
        return undefined;
    },

    getDeadState: function () {
        if (typeof window !== "undefined" && typeof window.deadState !== "undefined") {
            return window.deadState;
        }
        if (typeof deadState !== "undefined") return deadState;
        return undefined;
    },

    getOverState: function () {
        if (typeof window !== "undefined" && typeof window.overState !== "undefined") {
            return window.overState;
        }
        if (typeof overState !== "undefined") return overState;
        return undefined;
    },

    getFinishState: function () {
        if (typeof window !== "undefined" && typeof window.finishState !== "undefined") {
            return window.finishState;
        }
        if (typeof finishState !== "undefined") return finishState;
        return undefined;
    },

    getHomeState: function () {
        if (typeof window !== "undefined" && typeof window.homeState !== "undefined") {
            return window.homeState;
        }
        if (typeof homeState !== "undefined") return homeState;
        return undefined;
    },

    getPreNewGameState: function () {
        if (typeof window !== "undefined" && typeof window.preNewGameState !== "undefined") {
            return window.preNewGameState;
        }
        if (typeof preNewGameState !== "undefined") return preNewGameState;
        return undefined;
    },

    getNewGameState: function () {
        if (typeof window !== "undefined" && typeof window.newGameState !== "undefined") {
            return window.newGameState;
        }
        if (typeof newGameState !== "undefined") return newGameState;
        return undefined;
    },



    getStateVector: function () {

        if (
            !pacman ||
            typeof map === "undefined" ||
            !map ||
            typeof getOpenTiles !== "function" ||
            typeof ghosts === "undefined" ||
            !ghosts
        ) {
            console.warn("getStateVector returning null due to missing globals (pacman, map, getOpenTiles, or ghosts)");
            return null;
        }

        var state = [];

        state.push(
            pacman.tile.x / Math.max(1, map.numCols)
        );
        state.push(
            pacman.tile.y / Math.max(1, map.numRows)
        );

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

        var openTiles = getOpenTiles(
            pacman.tile,
            pacman.dirEnum
        );

        state.push(
            openTiles[DIR_UP] ? 1 : 0
        );
        state.push(
            openTiles[DIR_DOWN] ? 1 : 0
        );
        state.push(
            openTiles[DIR_LEFT] ? 1 : 0
        );
        state.push(
            openTiles[DIR_RIGHT] ? 1 : 0
        );

        state.push(
            this.bfsPelletDistance(pacman.tile, DIR_UP)
        );
        state.push(
            this.bfsPelletDistance(pacman.tile, DIR_DOWN)
        );
        state.push(
            this.bfsPelletDistance(pacman.tile, DIR_LEFT)
        );
        state.push(
            this.bfsPelletDistance(pacman.tile, DIR_RIGHT)
        );

        var pelletsNW = 0;
        var pelletsNE = 0;
        var pelletsSW = 0;
        var pelletsSE = 0;
        var pelletsTotal = 0;

        if (
            map.currentTiles &&
            typeof map.numTiles !== "undefined"
        ) {

            for (
                var qi = 0;
                qi < map.numTiles;
                qi++
            ) {

                var qTile = map.currentTiles[qi];

                if (qTile === "." || qTile === "o") {

                    pelletsTotal++;

                    var qx = qi % map.numCols;
                    var qy = Math.floor(qi / map.numCols);

                    if (qy <= pacman.tile.y) {
                        if (qx <= pacman.tile.x) pelletsNW++;
                        else pelletsNE++;
                    } else {
                        if (qx <= pacman.tile.x) pelletsSW++;
                        else pelletsSE++;
                    }
                }
            }
        }

        var pTotal = Math.max(1, pelletsTotal);

        state.push(pelletsNW / pTotal);
        state.push(pelletsNE / pTotal);
        state.push(pelletsSW / pTotal);
        state.push(pelletsSE / pTotal);

        var immediateDanger = 0;

        var nearestDangerousDist = Infinity;
        var nearestDangerousDx = 0;
        var nearestDangerousDy = 0;

        var nearestScaredDist = Infinity;
        var nearestScaredDx = 0;
        var nearestScaredDy = 0;

        var ghostAlarmUp = 0;
        var ghostAlarmDown = 0;
        var ghostAlarmLeft = 0;
        var ghostAlarmRight = 0;

        ghosts.forEach(function (ghost) {

            var dx =
                ghost.tile.x -
                pacman.tile.x;

            var dy =
                ghost.tile.y -
                pacman.tile.y;

            var distance =
                Math.sqrt(
                    dx * dx +
                    dy * dy
                );

            var normDist =
                Math.min(
                    distance / 30,
                    1
                );

            var isDangerous =
                ghost.mode === 0 &&
                !ghost.scared;

            if (
                isDangerous &&
                distance <= 3
            ) {

                immediateDanger = 1;

                if (dy < 0 && Math.abs(dy) >= Math.abs(dx)) ghostAlarmUp = 1;
                if (dy > 0 && Math.abs(dy) >= Math.abs(dx)) ghostAlarmDown = 1;
                if (dx < 0 && Math.abs(dx) > Math.abs(dy)) ghostAlarmLeft = 1;
                if (dx > 0 && Math.abs(dx) > Math.abs(dy)) ghostAlarmRight = 1;
            }

            if (
                isDangerous &&
                distance < nearestDangerousDist
            ) {

                nearestDangerousDist = distance;

                nearestDangerousDx = dx;
                nearestDangerousDy = dy;
            }

            if (
                ghost.mode === 0 &&
                ghost.scared &&
                distance < nearestScaredDist
            ) {

                nearestScaredDist = distance;

                nearestScaredDx = dx;
                nearestScaredDy = dy;
            }

            state.push(dx / 30);
            state.push(dy / 30);
            state.push(normDist);

            state.push(
                ghost.scared ? 1 : 0
            );

            state.push(
                isDangerous ? 1 : 0
            );
        });

        var nearestPelletDist = Infinity;
        var nearestPelletDx = 0;
        var nearestPelletDy = 0;

        if (
            map.currentTiles &&
            typeof map.numTiles !== "undefined"
        ) {

            for (
                var i = 0;
                i < map.numTiles;
                i++
            ) {

                var tile =
                    map.currentTiles[i];

                if (
                    tile === "." ||
                    tile === "o"
                ) {

                    var x =
                        i % map.numCols;

                    var y =
                        Math.floor(
                            i / map.numCols
                        );

                    var pdx =
                        x -
                        pacman.tile.x;

                    var pdy =
                        y -
                        pacman.tile.y;

                    var distSq =
                        pdx * pdx +
                        pdy * pdy;

                    if (
                        distSq <
                        nearestPelletDist
                    ) {

                        nearestPelletDist =
                            distSq;

                        nearestPelletDx =
                            pdx;

                        nearestPelletDy =
                            pdy;
                    }
                }
            }
        }

        if (
            nearestPelletDist === Infinity
        ) {

            state.push(0);
            state.push(0);
            state.push(1);

        } else {

            var pelletDist =
                Math.sqrt(
                    nearestPelletDist
                );

            state.push(
                nearestPelletDx / 30
            );

            state.push(
                nearestPelletDy / 30
            );

            state.push(
                Math.min(
                    pelletDist / 30,
                    1
                )
            );
        }

        var nearestEnDist = Infinity;
        var nearestEnDx = 0;
        var nearestEnDy = 0;

        if (map.energizers) {

            map.energizers.forEach(
                function (en) {

                    var index =
                        en.y *
                        map.numCols +
                        en.x;

                    if (
                        map.currentTiles[index] === "o"
                    ) {

                        var edx =
                            en.x -
                            pacman.tile.x;

                        var edy =
                            en.y -
                            pacman.tile.y;

                        var eDistSq =
                            edx * edx +
                            edy * edy;

                        if (
                            eDistSq <
                            nearestEnDist
                        ) {

                            nearestEnDist =
                                eDistSq;

                            nearestEnDx =
                                edx;

                            nearestEnDy =
                                edy;
                        }
                    }
                }
            );
        }

        if (
            nearestEnDist === Infinity
        ) {

            state.push(0);
            state.push(0);
            state.push(1);

        } else {

            var energizerDist =
                Math.sqrt(
                    nearestEnDist
                );

            state.push(
                nearestEnDx / 30
            );

            state.push(
                nearestEnDy / 30
            );

            state.push(
                Math.min(
                    energizerDist / 30,
                    1
                )
            );
        }

        if (
            nearestDangerousDist === Infinity
        ) {

            state.push(0);
            state.push(0);
            state.push(1);

        } else {

            state.push(
                nearestDangerousDx / 30
            );

            state.push(
                nearestDangerousDy / 30
            );

            state.push(
                Math.min(
                    nearestDangerousDist / 30,
                    1
                )
            );
        }

        if (
            nearestScaredDist === Infinity
        ) {

            state.push(0);
            state.push(0);
            state.push(1);

        } else {

            state.push(
                nearestScaredDx / 30
            );

            state.push(
                nearestScaredDy / 30
            );

            state.push(
                Math.min(
                    nearestScaredDist / 30,
                    1
                )
            );
        }

        state.push(
            map.dotsEaten /
            Math.max(
                1,
                map.numDots
            )
        );

        var energizerActive = 0;

        if (
            typeof energizer !== "undefined" &&
            energizer &&
            typeof energizer.isActive === "function"
        ) {

            energizerActive =
                energizer.isActive()
                    ? 1
                    : 0;
        }

        state.push(
            energizerActive
        );

        state.push(
            immediateDanger
        );

        var livesNorm = 0;

        if (typeof extraLives !== "undefined") {
            livesNorm = Math.min(extraLives / 3.0, 1.0);
        }

        state.push(livesNorm);

        state.push(
            Math.min(this.stepsSinceLastPellet / 100.0, 1.0)
        );

        state.push(ghostAlarmUp);
        state.push(ghostAlarmDown);
        state.push(ghostAlarmLeft);
        state.push(ghostAlarmRight);

        state.push(
            this.isCorridorOrDeadEnd(pacman.tile, DIR_UP)
        );

        state.push(
            this.isCorridorOrDeadEnd(pacman.tile, DIR_DOWN)
        );

        state.push(
            this.isCorridorOrDeadEnd(pacman.tile, DIR_LEFT)
        );

        state.push(
            this.isCorridorOrDeadEnd(pacman.tile, DIR_RIGHT)
        );

        var levelNorm = 0;

        if (typeof level !== "undefined") {
            levelNorm = Math.min(level / 21.0, 1.0);
        }

        state.push(levelNorm);

        var scoreNorm = 0;

        if (typeof getScore === "function") {
            scoreNorm = Math.min(getScore() / 10000.0, 1.0);
        }

        state.push(scoreNorm);

        var totalWeight = pelletsNW + pelletsNE + pelletsSW + pelletsSE;

        if (totalWeight > 0) {

            state.push((pelletsNW + pelletsNE) / totalWeight);
            state.push((pelletsSW + pelletsSE) / totalWeight);
            state.push((pelletsNW + pelletsSW) / totalWeight);

        } else {

            state.push(0.25);
            state.push(0.25);
            state.push(0.25);
        }

        var reverseDir = pacman.dirEnum;

        if (reverseDir === DIR_UP) reverseDir = DIR_DOWN;
        else if (reverseDir === DIR_DOWN) reverseDir = DIR_UP;
        else if (reverseDir === DIR_LEFT) reverseDir = DIR_RIGHT;
        else if (reverseDir === DIR_RIGHT) reverseDir = DIR_LEFT;

        state.push(reverseDir === DIR_UP ? 1 : 0);
        state.push(reverseDir === DIR_DOWN ? 1 : 0);
        state.push(reverseDir === DIR_LEFT ? 1 : 0);
        state.push(reverseDir === DIR_RIGHT ? 1 : 0);

        if (state.length !== 72) {

            console.error(
                "INVALID STATE VECTOR SIZE:",
                state.length,
                "Expected: 72"
            );

            return null;
        }

        return state;
    },

    setupBrowserLogging: function () {

        if (console._neuralAIInstalled)
            return;

        console._neuralAIInstalled = true;

        console._originalLog =
            console.log.bind(console);

        console._originalInfo =
            console.info.bind(console);

        console._originalDebug =
            console.debug.bind(console);

        console._originalWarn =
            console.warn.bind(console);

        console._originalError =
            console.error.bind(console);

        var sendBrowserLog =
            function (level, args) {

                if (
                    !neuralAI.socket ||
                    neuralAI.socket.readyState !== WebSocket.OPEN
                ) {
                    return;
                }

                try {

                    neuralAI.socket.send(
                        JSON.stringify({

                            type: "log",

                            level: level,

                            message:
                                args.map(
                                    function (value) {

                                        try {

                                            if (
                                                typeof value ===
                                                "string"
                                            ) {
                                                return value;
                                            }

                                            return JSON.stringify(
                                                value
                                            );

                                        } catch (e) {

                                            return String(
                                                value
                                            );
                                        }
                                    }
                                )
                        })
                    );

                } catch (e) {

                    console._originalError(
                        "Failed to send browser log:",
                        e
                    );
                }
            };

        console.log = function () {

            console._originalLog.apply(
                console,
                arguments
            );

            sendBrowserLog(
                "info",
                Array.prototype.slice.call(
                    arguments
                )
            );
        };

        console.info = function () {

            console._originalInfo.apply(
                console,
                arguments
            );

            sendBrowserLog(
                "info",
                Array.prototype.slice.call(
                    arguments
                )
            );
        };

        console.debug = function () {

            console._originalDebug.apply(
                console,
                arguments
            );

            sendBrowserLog(
                "debug",
                Array.prototype.slice.call(
                    arguments
                )
            );
        };

        console.warn = function () {

            console._originalWarn.apply(
                console,
                arguments
            );

            sendBrowserLog(
                "warn",
                Array.prototype.slice.call(
                    arguments
                )
            );
        };

        console.error = function () {

            console._originalError.apply(
                console,
                arguments
            );

            sendBrowserLog(
                "error",
                Array.prototype.slice.call(
                    arguments
                )
            );
        };
    },



    // =========================================================================
    // CONNECT
    // =========================================================================

    connect: function () {

        this.socket =
            new WebSocket(
                "ws://" +
                window.location.hostname +
                ":8765"
            );


        this.setupBrowserLogging();


        this.socket.onopen =
            function () {

                console.log(
                    "Connected to Python AI"
                );


                neuralAI.previousScore =
                    typeof getScore === "function"
                        ? getScore()
                        : 0;


                console.log(
                    "Connection score:",
                    neuralAI.previousScore
                );


                neuralAI.waitingForReset = false;
                neuralAI.waitingForPlayable = false;
                neuralAI.transitionPending = false;
                neuralAI.terminalSent = false;


                neuralAI.waitUntilPlayable(
                    function () {

                        neuralAI.sendState();
                    }
                );
            };


        this.socket.onmessage =
            function (event) {

                var message;

                try {

                    message =
                        JSON.parse(
                            event.data
                        );

                } catch (e) {

                    console.error(
                        "Invalid WebSocket message:",
                        event.data
                    );

                    return;
                }


                // =============================================================
                // ACTION
                // =============================================================

                if (
                    message.type ===
                    "action"
                ) {

                    neuralAI.handleAction(
                        message.action
                    );

                    return;
                }


                // =============================================================
                // RESET
                // =============================================================

                if (
                    message.type ===
                    "reset"
                ) {

                    neuralAI.handleReset();

                    return;
                }
            };


        this.socket.onclose =
            function () {

                console.log(
                    "Disconnected from Python AI"
                );
            };


        this.socket.onerror =
            function (error) {

                console.error(
                    "WebSocket error:",
                    error
                );
            };
    },


    handleAction: function (action) {

        if (
            this.waitingForReset ||
            this.waitingForPlayable ||
            this.transitionPending ||
            this.terminalSent
        ) {

            console.log(
                "Ignoring action because AI is waiting"
            );

            return;
        }

        var oldState =
            this.getStateVector();

        if (!oldState) {

            console.warn(
                "Cannot execute action: state unavailable"
            );

            this.waitUntilPlayable(
                function () {

                    neuralAI.sendState();
                }
            );

            return;
        }

        var oldScore =
            typeof getScore === "function"
                ? getScore()
                : 0;

        this.lastState =
            oldState;

        this.lastAction =
            action;

        console.log(
            "BEFORE ACTION",
            {
                score: oldScore,
                action: action,
                tileX: pacman.tile.x,
                tileY: pacman.tile.y
            }
        );

        if (action === 0)
            pacman.setInputDir(DIR_UP);

        else if (action === 1)
            pacman.setInputDir(DIR_LEFT);

        else if (action === 2)
            pacman.setInputDir(DIR_DOWN);

        else if (action === 3)
            pacman.setInputDir(DIR_RIGHT);

        else {

            console.error(
                "Invalid action:",
                action
            );

            return;
        }

        console.log(
            "ACTION APPLIED",
            {
                action: action,
                score:
                    typeof getScore === "function"
                        ? getScore()
                        : 0,
                tileX: pacman.tile.x,
                tileY: pacman.tile.y
            }
        );

        this.transitionPending = true;

        setTimeout(
            function () {

                neuralAI.sendTransition(
                    oldState,
                    oldScore,
                    action
                );

            },
            100
        );
    },

    sendState: function () {

        if (
            !this.socket ||
            this.socket.readyState !== WebSocket.OPEN
        ) {
            return;
        }

        if (
            this.waitingForReset ||
            this.transitionPending ||
            this.terminalSent
        ) {
            return;
        }

        var gameState =
            this.getGameState();

        var playState =
            this.getPlayState();

        var overState =
            this.getOverState();

        if (
            typeof gameState !== "undefined" &&
            typeof overState !== "undefined" &&
            gameState === overState
        ) {

            console.log(
                "Game is over. Waiting for reset."
            );

            this.waitingForReset = true;

            return;
        }

        if (
            typeof gameState !== "undefined" &&
            typeof playState !== "undefined" &&
            gameState !== playState
        ) {

            this.waitUntilPlayable(
                function () {

                    neuralAI.sendState();
                }
            );

            return;
        }

        var stateVector =
            this.getStateVector();

        if (!stateVector) {

            setTimeout(
                function () {

                    neuralAI.sendState();
                },
                100
            );

            return;
        }

        console.log("Sending state to Python (len: " + stateVector.length + ")");
        this.socket.send(
            JSON.stringify({

                type: "state",

                state: stateVector
            })
        );
    },

    waitUntilPlayable: function (callback) {

        if (this.waitingForPlayable) {
            this.playableCallback = callback;
            return;
        }

        this.waitingForPlayable = true;
        this.playableCallback = callback;

        var attempts = 0;

        var check = function () {

            var gameState =
                neuralAI.getGameState();

            var playState =
                neuralAI.getPlayState();

            if (
                typeof gameState !== "undefined" &&
                typeof playState !== "undefined" &&
                gameState === playState
            ) {

                neuralAI.waitingForPlayable =
                    false;

                if (typeof neuralAI.playableCallback === "function") {

                    var cb = neuralAI.playableCallback;
                    neuralAI.playableCallback = null;

                    setTimeout(cb, 0);
                }

                return;
            }

            attempts++;

            if (
                attempts >=
                neuralAI.MAX_WAIT_ATTEMPTS
            ) {

                neuralAI.waitingForPlayable =
                    false;

                console.warn(
                    "Timed out waiting for playable state."
                );

                return;
            }

            neuralAI.playableTimer =
                setTimeout(
                    check,
                    neuralAI.WAIT_INTERVAL
                );
        };

        check();
    },

    handleReset: function () {

        console.log(
            "RESET received from Python"
        );

        this.waitingForReset = true;
        this.waitingForPlayable = false;
        this.transitionPending = false;
        this.terminalSent = false;

        if (this.playableTimer) {

            clearTimeout(
                this.playableTimer
            );

            this.playableTimer = null;
        }

        if (this.deathTimer) {

            clearTimeout(
                this.deathTimer
            );

            this.deathTimer = null;
        }

        this.previousScore =
            typeof getScore === "function"
                ? getScore()
                : 0;

        this.resetTracking();

        var gameState =
            this.getGameState();

        var overState =
            this.getOverState();

        var homeState =
            this.getHomeState();

        var preNewGameState =
            this.getPreNewGameState();

        var newGameState =
            this.getNewGameState();

        if (
            typeof newGameState !== "undefined" &&
            typeof switchState !== "undefined"
        ) {

            console.log(
                "Starting new RL episode from Level 1 (3 Lives)"
            );

            if (
                typeof window !== "undefined"
            ) {

                window.practiceMode =
                    false;

                window.turboMode =
                    false;
            }

            if (
                typeof practiceMode !==
                "undefined"
            ) {

                practiceMode = false;
            }

            if (
                typeof turboMode !==
                "undefined"
            ) {

                turboMode = false;
            }

            if (
                typeof newGameState.setStartLevel ===
                "function"
            ) {

                newGameState.setStartLevel(
                    1
                );
            }

            switchState(
                newGameState
            );
        }

        this.waitUntilPlayable(
            function () {

                neuralAI.waitingForReset =
                    false;

                neuralAI.transitionPending =
                    false;

                neuralAI.terminalSent =
                    false;

                console.log(
                    "New episode ready."
                );

                neuralAI.sendState();
            }
        );
    },

    sendTransition: function (
        oldState,
        oldScore,
        action
    ) {

        if (
            !this.socket ||
            this.socket.readyState !== WebSocket.OPEN
        ) {
            this.transitionPending =
                false;

            return;
        }

        if (
            this.terminalSent
        ) {

            this.transitionPending =
                false;

            return;
        }

        var self = this;

        var currentScore =
            typeof getScore === "function"
                ? getScore()
                : 0;

        var scoreReward =
            currentScore -
            oldScore;

        var gameState =
            this.getGameState();

        var deadState =
            this.getDeadState();

        var overState =
            this.getOverState();

        var finishState =
            this.getFinishState();

        var isDead =
            typeof gameState !== "undefined" &&
            typeof deadState !== "undefined" &&
            gameState === deadState;

        var isGameOver =
            typeof gameState !== "undefined" &&
            typeof overState !== "undefined" &&
            gameState === overState;

        var isLevelComplete =
            typeof gameState !== "undefined" &&
            typeof finishState !== "undefined" &&
            gameState === finishState;

        if (isDead) {

            this.waitForDeathToFinish(
                oldState,
                oldScore,
                action
            );

            return;
        }

        var nextState =
            this.getStateVector();

        if (!nextState)
            nextState = oldState;

        var done =
            isGameOver ||
            isLevelComplete;

        var reward = 0;

        if (isLevelComplete) {

            reward = 50;

            this.stepsSinceLastPellet = 0;

            console.log(
                "[AI EVENT] LEVEL COMPLETE",
                {
                    reward: reward,
                    done: true
                }
            );
        }

        else if (isGameOver) {

            reward = -10;

            this.stepsSinceLastPellet = 0;

            console.log(
                "[AI EVENT] GAME OVER",
                {
                    reward: reward,
                    done: true
                }
            );
        }

        else if (scoreReward >= 200) {

            reward = 10;
            this.stepsSinceLastPellet++;

            console.log(
                "[AI EVENT] GHOST_EATEN",
                {
                    scoreChange: scoreReward,
                    reward: reward
                }
            );
        }

        else if (scoreReward === 50) {

            reward = 5;
            this.stepsSinceLastPellet = 0;

            console.log(
                "[AI EVENT] ENERGIZER",
                {
                    scoreChange: scoreReward,
                    reward: reward
                }
            );
        }

        else if (scoreReward === 10) {

            reward = 1;
            this.stepsSinceLastPellet = 0;

            console.log(
                "[AI EVENT] PELLET",
                {
                    scoreChange: scoreReward,
                    reward: reward
                }
            );
        }

        else {

            var oldX =
                oldState[0];

            var oldY =
                oldState[1];

            var nextX =
                nextState[0];

            var nextY =
                nextState[1];

            if (
                oldX === nextX &&
                oldY === nextY
            ) {

                reward = -0.05;
                this.stepsSinceLastPellet += 2;

                console.log(
                    "[AI EVENT] BLOCKED",
                    {
                        action: action,
                        reward: reward
                    }
                );

            } else {

                reward = 0;

                this.stepsSinceLastPellet++;

                if (this.stepsSinceLastPellet > 30) {
                    var stallPenalty = 0.05 * Math.min((this.stepsSinceLastPellet - 30) / 20.0, 1.0);
                    reward -= stallPenalty;
                }

                console.log(
                    "[AI EVENT] MOVE",
                    {
                        reward: reward,
                        stepsSinceLastPellet: this.stepsSinceLastPellet
                    }
                );
            }
        }

        if (
            !done &&
            !isDead
        ) {

            var shapingReward = 0;

            for (
                var i = 0;
                i < 4;
                i++
            ) {

                var oldDist =
                    oldState[
                    12 + i * 5
                    ] * 30;

                var nextDist =
                    nextState[
                    12 + i * 5
                    ] * 30;

                var isDangerous =
                    nextState[
                    14 + i * 5
                    ] === 1;

                if (
                    isDangerous &&
                    (
                        oldDist <= 5 ||
                        nextDist <= 5
                    )
                ) {

                    if (
                        nextDist < oldDist
                    ) {

                        shapingReward -= 0.3;

                    } else if (
                        nextDist > oldDist
                    ) {

                        shapingReward += 0.3;
                    }
                }
            }

            shapingReward =
                Math.max(
                    -0.8,
                    Math.min(
                        shapingReward,
                        0.8
                    )
                );

            if (
                shapingReward !== 0
            ) {

                reward +=
                    shapingReward;

                reward =
                    Math.round(
                        reward * 100
                    ) / 100;

                console.log(
                    "[AI EVENT] SHAPING",
                    {
                        shapingReward:
                            shapingReward,
                        totalReward:
                            reward
                    }
                );
            }
        }

        this.previousScore =
            currentScore;

        if (done) {

            this.terminalSent =
                true;
        }

        this.socket.send(
            JSON.stringify({

                type: "transition",

                state: oldState,

                action: action,

                next_state: nextState,

                reward: reward,

                done: done
            })
        );

        console.log(
            "[AI EVENT] TRANSITION SENT",
            {
                action: action,
                reward: reward,
                done: done
            }
        );

        this.transitionPending =
            false;

        if (!done) {

            this.waitUntilPlayable(
                function () {

                    neuralAI.sendState();
                }
            );

            return;
        }

        console.log(
            "Terminal transition sent. Waiting for Python reset."
        );
    },

    waitForDeathToFinish: function (
        oldState,
        oldScore,
        action
    ) {

        if (this.terminalSent)
            return;

        if (this.deathTimer)
            return;

        var attempts = 0;

        var checkDeath = function () {

            var gameState =
                neuralAI.getGameState();

            var deadState =
                neuralAI.getDeadState();

            var overState =
                neuralAI.getOverState();

            if (
                typeof gameState !== "undefined" &&
                typeof overState !== "undefined" &&
                gameState === overState
            ) {

                neuralAI.deathTimer =
                    null;

                neuralAI.sendTransition(
                    oldState,
                    oldScore,
                    action
                );

                return;
            }

            if (
                typeof gameState !== "undefined" &&
                typeof deadState !== "undefined" &&
                gameState === deadState
            ) {

                attempts++;

                if (
                    attempts >=
                    neuralAI.MAX_WAIT_ATTEMPTS
                ) {

                    console.warn(
                        "Death-state wait timed out. Sending terminal transition."
                    );

                    neuralAI.deathTimer =
                        null;

                    neuralAI.sendForcedDeathTransition(
                        oldState,
                        oldScore,
                        action
                    );

                    return;
                }

                neuralAI.deathTimer =
                    setTimeout(
                        checkDeath,
                        neuralAI.WAIT_INTERVAL
                    );

                return;
            }

            neuralAI.deathTimer =
                null;

            neuralAI.sendDeathTransition(
                oldState,
                oldScore,
                action
            );
        };

        checkDeath();
    },

    sendDeathTransition: function (
        oldState,
        oldScore,
        action
    ) {

        if (this.terminalSent)
            return;

        var nextState =
            this.getStateVector();

        if (!nextState)
            nextState = oldState;

        var currentScore =
            typeof getScore === "function"
                ? getScore()
                : oldScore;

        var gameState =
            this.getGameState();

        var overState =
            this.getOverState();

        var done =
            typeof gameState !== "undefined" &&
            typeof overState !== "undefined" &&
            gameState === overState;

        var reward = -10;

        console.log(
            "[AI EVENT] DEATH",
            {
                reward: reward,
                done: done,
                score: currentScore
            }
        );

        this.terminalSent =
            done;

        this.previousScore =
            currentScore;

        this.stepsSinceLastPellet = 0;

        this.socket.send(
            JSON.stringify({

                type: "transition",

                state: oldState,

                action: action,

                next_state: nextState,

                reward: reward,

                done: done
            })
        );

        console.log(
            "[AI EVENT] DEATH TRANSITION SENT",
            {
                reward: reward,
                done: done
            }
        );

        this.transitionPending =
            false;

        if (!done) {

            this.waitUntilPlayable(
                function () {

                    neuralAI.sendState();
                }
            );

        } else {

            console.log(
                "GAME OVER. Waiting for Python reset."
            );
        }
    },

    sendForcedDeathTransition: function (
        oldState,
        oldScore,
        action
    ) {

        if (this.terminalSent)
            return;

        var nextState =
            this.getStateVector();

        if (!nextState)
            nextState = oldState;

        this.terminalSent =
            true;

        this.transitionPending =
            false;

        this.stepsSinceLastPellet = 0;

        this.socket.send(
            JSON.stringify({

                type: "transition",

                state: oldState,

                action: action,

                next_state: nextState,

                reward: -10,

                done: true
            })
        );

        console.warn(
            "Forced terminal death transition sent."
        );
    }
};

if (
    typeof window !== "undefined"
) {

    window.addEventListener(
        "load",
        function () {

            if (!neuralAI.socket) {

                neuralAI.connect();
            }

            var checkAndStart =
                function () {

                    var gameState =
                        neuralAI.getGameState();

                    var homeState =
                        neuralAI.getHomeState();

                    var preNewGameState =
                        neuralAI.getPreNewGameState();

                    var newGameState =
                        neuralAI.getNewGameState();

                    var playState =
                        neuralAI.getPlayState();

                    if (
                        gameState === homeState ||
                        gameState === preNewGameState ||
                        gameState === undefined ||
                        gameState === newGameState
                    ) {

                        console.log(
                            "Auto-starting Neural Pac-Man"
                        );

                        if (
                            typeof window !==
                            "undefined"
                        ) {

                            window.practiceMode =
                                false;

                            window.turboMode =
                                false;
                        }

                        if (
                            typeof practiceMode !==
                            "undefined"
                        ) {

                            practiceMode =
                                false;
                        }

                        if (
                            typeof turboMode !==
                            "undefined"
                        ) {

                            turboMode =
                                false;
                        }

                        if (
                            typeof newGameState !==
                            "undefined" &&
                            typeof switchState !==
                            "undefined"
                        ) {

                            if (
                                gameState !==
                                newGameState
                            ) {

                                if (
                                    typeof newGameState.setStartLevel ===
                                    "function"
                                ) {

                                    newGameState.setStartLevel(
                                        1
                                    );
                                }

                                switchState(
                                    newGameState
                                );
                            }
                        }

                        neuralAI.waitingForReset =
                            true;

                        neuralAI.waitUntilPlayable(
                            function () {

                                neuralAI.waitingForReset =
                                    false;

                                neuralAI.sendState();
                            }
                        );

                        return;
                    }

                    if (
                        gameState ===
                        playState
                    ) {

                        neuralAI.waitingForReset =
                            false;

                        neuralAI.sendState();

                        return;
                    }

                    setTimeout(
                        checkAndStart,
                        100
                    );
                };

            setTimeout(
                checkAndStart,
                500
            );
        }
    );
}