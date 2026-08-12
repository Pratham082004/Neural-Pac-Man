//////////////////////////////////////////////////////////////////////////////////////
// Neural Pac-Man AI Interface

var neuralAI = {

    setDirection: function (dirEnum) {
        if (!pacman)
            return;

        pacman.setInputDir(dirEnum);
    },

    stop: function () {
        if (!pacman)
            return;

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

    getStateVector: function () {
        if (!pacman || typeof map === "undefined" || !map || typeof getOpenTiles !== "function") return null;

        var state = [];
        state.push(pacman.tile.x / map.numCols);
        state.push(pacman.tile.y / map.numRows);
        state.push(pacman.dirEnum === DIR_UP ? 1 : 0);
        state.push(pacman.dirEnum === DIR_DOWN ? 1 : 0);
        state.push(pacman.dirEnum === DIR_LEFT ? 1 : 0);
        state.push(pacman.dirEnum === DIR_RIGHT ? 1 : 0);

        var openTiles = getOpenTiles(pacman.tile, pacman.dirEnum);
        state.push(openTiles[DIR_UP] ? 1 : 0);
        state.push(openTiles[DIR_DOWN] ? 1 : 0);
        state.push(openTiles[DIR_LEFT] ? 1 : 0);
        state.push(openTiles[DIR_RIGHT] ? 1 : 0);

        var immediateDanger = 0;
        var nearestDangerousDist = Infinity, nearestDangerousDx = 0, nearestDangerousDy = 0;
        var nearestScaredDist = Infinity, nearestScaredDx = 0, nearestScaredDy = 0;

        ghosts.forEach(function (ghost) {
            var dx = ghost.tile.x - pacman.tile.x;
            var dy = ghost.tile.y - pacman.tile.y;
            var distance = Math.sqrt(dx * dx + dy * dy);
            var normDist = Math.min(distance / 30, 1);
            var isDangerous = (ghost.mode === 0 && !ghost.scared);

            if (isDangerous && distance <= 3) immediateDanger = 1;
            if (isDangerous && distance < nearestDangerousDist) {
                nearestDangerousDist = distance; nearestDangerousDx = dx; nearestDangerousDy = dy;
            }
            if (ghost.mode === 0 && ghost.scared && distance < nearestScaredDist) {
                nearestScaredDist = distance; nearestScaredDx = dx; nearestScaredDy = dy;
            }

            state.push(dx / 30); state.push(dy / 30); state.push(normDist);
            state.push(ghost.scared ? 1 : 0); state.push(isDangerous ? 1 : 0);
        });

        var nearestPelletDist = Infinity, nearestPelletDx = 0, nearestPelletDy = 0;
        for (var i = 0; i < map.numTiles; i++) {
            var c = map.currentTiles[i];
            if (c === '.' || c === 'o') {
                var x = i % map.numCols, y = Math.floor(i / map.numCols);
                var dx = x - pacman.tile.x, dy = y - pacman.tile.y;
                var distSq = dx * dx + dy * dy;
                if (distSq < nearestPelletDist) {
                    nearestPelletDist = distSq; nearestPelletDx = dx; nearestPelletDy = dy;
                }
            }
        }
        if (nearestPelletDist === Infinity) { state.push(0); state.push(0); state.push(1); }
        else {
            var dist = Math.sqrt(nearestPelletDist);
            state.push(nearestPelletDx / 30); state.push(nearestPelletDy / 30); state.push(Math.min(dist / 30, 1));
        }

        var nearestEnDist = Infinity, nearestEnDx = 0, nearestEnDy = 0;
        if (map.energizers) {
            map.energizers.forEach(function (en) {
                if (map.currentTiles[en.y * map.numCols + en.x] === 'o') {
                    var dx = en.x - pacman.tile.x, dy = en.y - pacman.tile.y;
                    var distSq = dx * dx + dy * dy;
                    if (distSq < nearestEnDist) { nearestEnDist = distSq; nearestEnDx = dx; nearestEnDy = dy; }
                }
            });
        }
        if (nearestEnDist === Infinity) { state.push(0); state.push(0); state.push(1); }
        else {
            var dist = Math.sqrt(nearestEnDist);
            state.push(nearestEnDx / 30); state.push(nearestEnDy / 30); state.push(Math.min(dist / 30, 1));
        }

        if (nearestDangerousDist === Infinity) { state.push(0); state.push(0); state.push(1); }
        else { state.push(nearestDangerousDx / 30); state.push(nearestDangerousDy / 30); state.push(Math.min(nearestDangerousDist / 30, 1)); }

        if (nearestScaredDist === Infinity) { state.push(0); state.push(0); state.push(1); }
        else { state.push(nearestScaredDx / 30); state.push(nearestScaredDy / 30); state.push(Math.min(nearestScaredDist / 30, 1)); }

        state.push(map.dotsEaten / Math.max(1, map.numDots));
        state.push(typeof energizer !== "undefined" && energizer.isActive() ? 1 : 0);
        state.push(immediateDanger);

        return state;
    },

    socket: null,

    previousScore: 0,

    waitingForReset: false,

    connect: function () {

        this.socket = new WebSocket(
            "ws://" + window.location.hostname + ":8765"
        );

        if (!console._originalLog) {
            console._originalLog = console.log.bind(console);
            console._originalInfo = console.info.bind(console);
            console._originalDebug = console.debug.bind(console);
            console._originalWarn = console.warn.bind(console);
            console._originalError = console.error.bind(console);
        }

        var originalConsoleLog = console._originalLog;
        var originalConsoleInfo = console._originalInfo;
        var originalConsoleDebug = console._originalDebug;
        var originalConsoleWarn = console._originalWarn;
        var originalConsoleError = console._originalError;

        var sendBrowserLog = function (level, args) {
            if (
                neuralAI.socket &&
                neuralAI.socket.readyState === WebSocket.OPEN
            ) {
                try {
                    neuralAI.socket.send(
                        JSON.stringify({
                            type: "log",
                            level: level,
                            message: args.map(function (value) {
                                try {
                                    if (typeof value === "string")
                                        return value;
                                    return JSON.stringify(value);
                                } catch (e) {
                                    return String(value);
                                }
                            })
                        })
                    );
                } catch (e) {
                    originalConsoleError(
                        "Failed to send log to Python:",
                        e
                    );
                }
            }
        };

        console.log = function () {
            originalConsoleLog.apply(console, arguments);
            sendBrowserLog("info", Array.prototype.slice.call(arguments));
        };

        console.info = function () {
            originalConsoleInfo.apply(console, arguments);
            sendBrowserLog("info", Array.prototype.slice.call(arguments));
        };

        console.debug = function () {
            originalConsoleDebug.apply(console, arguments);
            sendBrowserLog("debug", Array.prototype.slice.call(arguments));
        };

        console.warn = function () {
            originalConsoleWarn.apply(console, arguments);
            sendBrowserLog("warn", Array.prototype.slice.call(arguments));
        };

        console.error = function () {
            originalConsoleError.apply(console, arguments);
            sendBrowserLog("error", Array.prototype.slice.call(arguments));
        };

        this.socket.onopen = function () {

            console.log("Connected to Python AI");

            neuralAI.previousScore = getScore();

            console.log(
                "Connection score:",
                neuralAI.previousScore
            );
        };

        this.socket.onmessage = function (event) {

            var message = JSON.parse(event.data);

            if (message.type === "action") {

                if (neuralAI.waitingForReset) {
                    console.log(
                        "Ignoring action while reset is pending"
                    );
                    return;
                }

                var action = message.action;

                var oldState =
                    neuralAI.getStateVector();

                var oldScore =
                    getScore();

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
                    neuralAI.up();

                else if (action === 1)
                    neuralAI.left();

                else if (action === 2)
                    neuralAI.down();

                else if (action === 3)
                    neuralAI.right();

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
                        score: getScore(),
                        tileX: pacman.tile.x,
                        tileY: pacman.tile.y
                    }
                );

                setTimeout(function () {

                    console.log(
                        "AFTER 100ms",
                        {
                            score: getScore(),
                            tileX: pacman.tile.x,
                            tileY: pacman.tile.y
                        }
                    );

                    neuralAI.sendTransition(
                        oldState,
                        oldScore,
                        action
                    );

                }, 100);
            }

            else if (message.type === "reset") {

                neuralAI.waitingForReset = true;

                neuralAI.previousScore =
                    getScore();

                console.log(
                    "RESET",
                    {
                        score: neuralAI.previousScore
                    }
                );

                var waitForPlayableState = function () {

                    var gameState =
                        (typeof window !== "undefined"
                            ? window.state
                            : typeof state !== "undefined"
                                ? state
                                : undefined);

                    var gamePlayState =
                        (typeof window !== "undefined"
                            ? window.playState
                            : typeof playState !== "undefined"
                                ? playState
                                : undefined);

                    var gameOverState =
                        (typeof window !== "undefined"
                            ? window.overState
                            : typeof overState !== "undefined"
                                ? overState
                                : undefined);

                    var gameHomeState =
                        (typeof window !== "undefined"
                            ? window.homeState
                            : typeof homeState !== "undefined"
                                ? homeState
                                : undefined);

                    var gamePreNewGameState =
                        (typeof window !== "undefined"
                            ? window.preNewGameState
                            : typeof preNewGameState !== "undefined"
                                ? preNewGameState
                                : undefined);

                    if (typeof newGameState !== "undefined" && typeof switchState !== "undefined") {
                        if (gameState === gameOverState || gameState === gameHomeState || gameState === gamePreNewGameState) {
                            console.log("Forcing new game state for RL training");
                            if (typeof window !== "undefined") {
                                window.practiceMode = false;
                                window.turboMode = false;
                            }
                            if (typeof practiceMode !== "undefined") practiceMode = false;
                            if (typeof turboMode !== "undefined") turboMode = false;
                            newGameState.setStartLevel(1);
                            switchState(newGameState);


                        }
                    }

                    if (
                        typeof gameState !== "undefined" &&
                        typeof gamePlayState !== "undefined" &&
                        gameState !== gamePlayState
                    ) {
                        setTimeout(
                            waitForPlayableState,
                            50
                        );
                        return;
                    }

                    neuralAI.waitingForReset = false;
                    neuralAI.sendState();
                };

                waitForPlayableState();
            }
        };

        this.socket.onclose = function () {
            console.log("Disconnected from Python AI");
        };

        this.socket.onerror = function (error) {
            console.error("WebSocket error:", error);
        };
    },

    sendState: function () {

        if (
            !this.socket ||
            this.socket.readyState !== WebSocket.OPEN
        ) {
            return;
        }

        var gameState =
            (typeof state !== "undefined"
                ? state
                : typeof window !== "undefined"
                    ? window.state
                    : undefined);

        var gamePlayState =
            (typeof playState !== "undefined"
                ? playState
                : typeof window !== "undefined"
                    ? window.playState
                    : undefined);

        var gameOverState =
            (typeof overState !== "undefined"
                ? overState
                : typeof window !== "undefined"
                    ? window.overState
                    : undefined);

        if (
            typeof gameState !== "undefined" &&
            gameState === gameOverState
        ) {
            console.warn(
                "sendState skipped: game is over"
            );

            if (!this.waitingForReset) {
                var self = this;
                var currentScore = typeof getScore !== "undefined" ? getScore() : 0;
                var reward = -10; // death penalty

                console.log(
                    "GAME OVER (Missed Transition Recovery)",
                    {
                        score: currentScore,
                        reward: reward
                    }
                );

                this.socket.send(
                    JSON.stringify({
                        type: "transition",
                        state: self.lastState || self.getStateVector(),
                        action: self.lastAction !== undefined ? self.lastAction : 0,
                        next_state: self.getStateVector(),
                        reward: reward,
                        done: true
                    })
                );

                this.waitingForReset = true;
            }
            return;
        }

        if (
            typeof gameState !== "undefined" &&
            typeof gamePlayState !== "undefined" &&
            gameState !== gamePlayState
        ) {
            var self = this;
            console.warn(
                "sendState delayed: game is not in play state"
            );
            setTimeout(function () {
                self.sendState();
            }, 50);
            return;
        }

        var state =
            this.getStateVector();

        if (!state) {
            console.warn(
                "sendState skipped: state unavailable"
            );
            return;
        }

        this.socket.send(
            JSON.stringify({
                type: "state",
                state: state
            })
        );
    },

    sendTransition: function (oldState, oldScore, action) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

        this.lastState = oldState;
        this.lastAction = action;

        var self = this;
        var currentScore = typeof getScore !== "undefined" ? getScore() : 0;
        var scoreReward = currentScore - oldScore;

        var gameState = (typeof state !== "undefined" ? state : typeof window !== "undefined" ? window.state : undefined);
        var gameDeadState = (typeof deadState !== "undefined" ? deadState : typeof window !== "undefined" ? window.deadState : undefined);
        var gameOverState = (typeof overState !== "undefined" ? overState : typeof window !== "undefined" ? window.overState : undefined);
        var gameFinishState = (typeof finishState !== "undefined" ? finishState : typeof window !== "undefined" ? window.finishState : undefined);

        var terminalTransition = typeof gameState !== "undefined" && typeof gameDeadState !== "undefined" && gameState === gameDeadState && typeof extraLives !== "undefined" && extraLives === 0;
        var deadTransition = false;

        var sendTransitionNow = function () {
            var gameStateNow = (typeof state !== "undefined" ? state : typeof window !== "undefined" ? window.state : undefined);

            if (typeof gameStateNow !== "undefined" && typeof gameDeadState !== "undefined" && gameStateNow === gameDeadState) {
                console.warn("Waiting for deadState to finish before sending transition");
                setTimeout(sendTransitionNow, 50);
                return;
            }

            var nextState = self.getStateVector() || oldState;
            var isFinishState = typeof gameStateNow !== "undefined" && typeof gameFinishState !== "undefined" && gameStateNow === gameFinishState;
            
            var done = terminalTransition || (typeof gameStateNow !== "undefined" && typeof gameOverState !== "undefined" && gameStateNow === gameOverState) || isFinishState;

            var reward = 0;

            if (isFinishState) {
                reward = 50;
                console.log("[AI EVENT] LEVEL COMPLETE\nreward=" + reward + "\ndone=" + done);
            } else if (deadTransition) {
                reward = -10;
                console.log("[AI EVENT] DEATH\nreward=" + reward + "\ndone=" + done);
            } else if (done) {
                reward = -10;
                console.log("[AI EVENT] GAME OVER\nreward=" + reward + "\ndone=" + done);
            } else if (scoreReward === 50) {
                reward = 5;
                console.log("[AI EVENT] ENERGIZER\nscoreChange=" + scoreReward + "\nreward=" + reward);
            } else if (scoreReward === 10) {
                reward = 1;
                console.log("[AI EVENT] PELLET\nscoreChange=" + scoreReward + "\nreward=" + reward);
            } else if (scoreReward >= 200) {
                reward = 10;
                console.log("[AI EVENT] GHOST_EATEN\nscoreChange=" + scoreReward + "\nreward=" + reward);
            } else {
                var oldX = oldState[0];
                var oldY = oldState[1];
                var nextX = nextState[0];
                var nextY = nextState[1];
                if (oldX === nextX && oldY === nextY) {
                    reward = -0.05;
                    console.log("[AI EVENT] BLOCKED\naction=" + action + "\nposition=(" + oldX + "," + oldY + ")\nreward=" + reward);
                } else {
                    reward = 0;
                    console.log("[AI EVENT] MOVE\nreward=" + reward);
                }
            }

            if (!deadTransition && !done) {
                var shapingReward = 0;
                for (var i = 0; i < 4; i++) {
                    var oldDist = oldState[12 + i * 5] * 30;
                    var nextDist = nextState[12 + i * 5] * 30;
                    var isDangerous = nextState[14 + i * 5] === 1;

                    if (isDangerous) {
                        if (oldDist <= 5 || nextDist <= 5) {
                            if (nextDist < oldDist) shapingReward -= 0.3;
                            else if (nextDist > oldDist) shapingReward += 0.3;
                        }
                    }
                }
                
                if (shapingReward !== 0) {
                    if (shapingReward > 0.8) shapingReward = 0.8;
                    if (shapingReward < -0.8) shapingReward = -0.8;
                    reward += shapingReward;
                    reward = Math.round(reward * 100) / 100;
                    console.log("[AI EVENT] SHAPING\nreward=" + reward);
                }
            }

            neuralAI.previousScore = currentScore;
            self.socket.send(JSON.stringify({ type: "transition", state: oldState, action: action, next_state: nextState, reward: reward, done: done }));

            if (!done) {
                setTimeout(function () { self.sendState(); }, 50);
            }
        };

        if (typeof gameState !== "undefined" && gameState === gameDeadState) {
            deadTransition = true;
            setTimeout(sendTransitionNow, 50);
            return;
        }

        sendTransitionNow();
    }
};

// Automatically connect and start game on load
if (typeof window !== "undefined") {
    window.addEventListener("load", function () {
        if (!neuralAI.socket) {
            neuralAI.connect();
        }

        var checkAndStart = function () {
            var gameState =
                (typeof window !== "undefined"
                    ? window.state
                    : typeof state !== "undefined"
                        ? state
                        : undefined);

            var gameHomeState =
                (typeof window !== "undefined"
                    ? window.homeState
                    : typeof homeState !== "undefined"
                        ? homeState
                        : undefined);

            var gamePreNewGameState =
                (typeof window !== "undefined"
                    ? window.preNewGameState
                    : typeof preNewGameState !== "undefined"
                        ? preNewGameState
                        : undefined);

            var gameNewGameState =
                (typeof window !== "undefined"
                    ? window.newGameState
                    : typeof newGameState !== "undefined"
                        ? newGameState
                        : undefined);

            var gamePlayState =
                (typeof window !== "undefined"
                    ? window.playState
                    : typeof playState !== "undefined"
                        ? playState
                        : undefined);

            if (gameState === gameHomeState || gameState === gamePreNewGameState || gameState === undefined || gameState === gameNewGameState) {
                console.log("Auto-starting game from ai.js");
                if (typeof window !== "undefined") {
                    window.practiceMode = false;
                    window.turboMode = false;
                }
                if (typeof practiceMode !== "undefined") practiceMode = false;
                if (typeof turboMode !== "undefined") turboMode = false;

                if (typeof newGameState !== "undefined" && typeof switchState !== "undefined") {
                    if (gameState !== gameNewGameState) {
                        newGameState.setStartLevel(1);
                        switchState(newGameState);
                    }
                }



                neuralAI.waitingForReset = true;
                var waitForPlayableState = function () {
                    var gameStateNow =
                        (typeof window !== "undefined"
                            ? window.state
                            : typeof state !== "undefined"
                                ? state
                                : undefined);

                    if (gameStateNow !== gamePlayState) {
                        setTimeout(waitForPlayableState, 50);
                        return;
                    }



                    neuralAI.waitingForReset = false;
                    neuralAI.sendState();
                };
                waitForPlayableState();
            } else if (gameState === gamePlayState) {
                if (typeof window !== "undefined") window.practiceMode = false;
                if (typeof practiceMode !== "undefined") practiceMode = false;

                neuralAI.sendState();
            } else {
                setTimeout(checkAndStart, 100);
            }
        };

        // Give the main game script time to initialize the state
        setTimeout(checkAndStart, 500);
    });
}