//////////////////////////////////////////////////////////////////////////////////////
// Neural Pac-Man AI Interface
//
// V2
// - 45-dimensional state vector
// - Pellet / Energizer / Ghost / Level rewards
// - Ghost danger shaping
// - Controlled episode synchronization
// - Automatic game reset
// - No infinite sendState polling
// - No duplicate terminal transitions
//////////////////////////////////////////////////////////////////////////////////////

var neuralAI = {

    // =========================================================================
    // CONNECTION / STATE
    // =========================================================================

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


    // =========================================================================
    // MOVEMENT
    // =========================================================================

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


    // =========================================================================
    // RAW STATE
    // =========================================================================

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


    // =========================================================================
    // GAME STATE HELPERS
    // =========================================================================

    getGameState: function () {

        if (typeof window !== "undefined" &&
            typeof window.state !== "undefined") {

            return window.state;
        }

        if (typeof state !== "undefined")
            return state;

        return undefined;
    },


    getPlayState: function () {

        if (typeof window !== "undefined" &&
            typeof window.playState !== "undefined") {

            return window.playState;
        }

        if (typeof playState !== "undefined")
            return playState;

        return undefined;
    },


    getDeadState: function () {

        if (typeof window !== "undefined" &&
            typeof window.deadState !== "undefined") {

            return window.deadState;
        }

        if (typeof deadState !== "undefined")
            return deadState;

        return undefined;
    },


    getOverState: function () {

        if (typeof window !== "undefined" &&
            typeof window.overState !== "undefined") {

            return window.overState;
        }

        if (typeof overState !== "undefined")
            return overState;

        return undefined;
    },


    getFinishState: function () {

        if (typeof window !== "undefined" &&
            typeof window.finishState !== "undefined") {

            return window.finishState;
        }

        if (typeof finishState !== "undefined")
            return finishState;

        return undefined;
    },


    getHomeState: function () {

        if (typeof window !== "undefined" &&
            typeof window.homeState !== "undefined") {

            return window.homeState;
        }

        if (typeof homeState !== "undefined")
            return homeState;

        return undefined;
    },


    getPreNewGameState: function () {

        if (typeof window !== "undefined" &&
            typeof window.preNewGameState !== "undefined") {

            return window.preNewGameState;
        }

        if (typeof preNewGameState !== "undefined")
            return preNewGameState;

        return undefined;
    },


    getNewGameState: function () {

        if (typeof window !== "undefined" &&
            typeof window.newGameState !== "undefined") {

            return window.newGameState;
        }

        if (typeof newGameState !== "undefined")
            return newGameState;

        return undefined;
    },


    // =========================================================================
    // STATE VECTOR
    //
    // TOTAL:
    //
    // Pac-Man position                 2
    // Pac-Man direction               4
    // Open directions                 4
    // Ghost information               20
    // Nearest pellet                  3
    // Nearest energizer               3
    // Nearest dangerous ghost         3
    // Nearest scared ghost            3
    // Dots eaten                      1
    // Energizer active                1
    // Immediate danger                1
    //
    // TOTAL = 45
    // =========================================================================

    getStateVector: function () {

        if (
            !pacman ||
            typeof map === "undefined" ||
            !map ||
            typeof getOpenTiles !== "function"
        ) {
            return null;
        }

        var state = [];

        // =====================================================================
        // PAC-MAN POSITION
        // =====================================================================

        state.push(
            pacman.tile.x / Math.max(1, map.numCols)
        );

        state.push(
            pacman.tile.y / Math.max(1, map.numRows)
        );


        // =====================================================================
        // PAC-MAN DIRECTION
        // =====================================================================

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


        // =====================================================================
        // OPEN DIRECTIONS
        // =====================================================================

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


        // =====================================================================
        // GHOST INFORMATION
        // 5 values per ghost
        //
        // dx
        // dy
        // distance
        // scared
        // dangerous
        // =====================================================================

        var immediateDanger = 0;

        var nearestDangerousDist = Infinity;
        var nearestDangerousDx = 0;
        var nearestDangerousDy = 0;

        var nearestScaredDist = Infinity;
        var nearestScaredDx = 0;
        var nearestScaredDy = 0;


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


        // =====================================================================
        // NEAREST PELLET
        // =====================================================================

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

                    var dx =
                        x -
                        pacman.tile.x;

                    var dy =
                        y -
                        pacman.tile.y;

                    var distSq =
                        dx * dx +
                        dy * dy;


                    if (
                        distSq <
                        nearestPelletDist
                    ) {

                        nearestPelletDist =
                            distSq;

                        nearestPelletDx =
                            dx;

                        nearestPelletDy =
                            dy;
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


        // =====================================================================
        // NEAREST ENERGIZER
        // =====================================================================

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

                        var dx =
                            en.x -
                            pacman.tile.x;

                        var dy =
                            en.y -
                            pacman.tile.y;

                        var distSq =
                            dx * dx +
                            dy * dy;


                        if (
                            distSq <
                            nearestEnDist
                        ) {

                            nearestEnDist =
                                distSq;

                            nearestEnDx =
                                dx;

                            nearestEnDy =
                                dy;
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


        // =====================================================================
        // NEAREST DANGEROUS GHOST
        // =====================================================================

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


        // =====================================================================
        // NEAREST SCARED GHOST
        // =====================================================================

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


        // =====================================================================
        // GLOBAL GAME FEATURES
        // =====================================================================

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


        // =====================================================================
        // SAFETY CHECK
        // =====================================================================

        if (state.length !== 45) {

            console.error(
                "INVALID STATE VECTOR SIZE:",
                state.length,
                "Expected: 45"
            );

            return null;
        }


        return state;
    },


    // =========================================================================
    // BROWSER LOGGING
    // =========================================================================

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


    // =========================================================================
    // HANDLE ACTION
    // =========================================================================

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


        // =============================================================
        // APPLY ACTION
        // =============================================================

        if (action === 0)
            this.up();

        else if (action === 1)
            this.left();

        else if (action === 2)
            this.down();

        else if (action === 3)
            this.right();

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


    // =========================================================================
    // SEND STATE
    //
    // IMPORTANT:
    // This function NEVER recursively schedules itself.
    // A single waitUntilPlayable() controls waiting.
    // =========================================================================

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


        // =============================================================
        // GAME OVER
        // =============================================================

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


        // =============================================================
        // NOT PLAYABLE
        // =============================================================

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


        // =============================================================
        // GET STATE
        // =============================================================

        var stateVector =
            this.getStateVector();


        if (!stateVector) {

            this.waitUntilPlayable(
                function () {

                    neuralAI.sendState();
                }
            );

            return;
        }


        this.socket.send(
            JSON.stringify({

                type: "state",

                state: stateVector
            })
        );
    },


    // =========================================================================
    // WAIT UNTIL PLAYABLE
    //
    // ONE TIMER ONLY.
    // No infinite chains of sendState().
    // =========================================================================

    waitUntilPlayable: function (callback) {

        if (this.waitingForPlayable)
            return;


        this.waitingForPlayable = true;


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


                if (typeof callback === "function")
                    callback();


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


    // =========================================================================
    // HANDLE RESET
    // =========================================================================

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


        // =============================================================
        // FORCE FULL NEW GAME
        // =============================================================

        if (
            typeof newGameState !== "undefined" &&
            typeof switchState !== "undefined"
        ) {

            if (
                gameState === overState ||
                gameState === homeState ||
                gameState === preNewGameState ||
                gameState === undefined
            ) {

                console.log(
                    "Starting new RL episode from Level 1"
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
        }


        // =============================================================
        // WAIT FOR PLAY
        // =============================================================

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


    // =========================================================================
    // SEND TRANSITION
    // =========================================================================

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


        // =============================================================
        // DEATH / TERMINAL DETECTION
        // =============================================================

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


        // =============================================================
        // DEATH STATE
        //
        // Wait only here.
        // Once deadState ends, send exactly one transition.
        // =============================================================

        if (isDead) {

            this.waitForDeathToFinish(
                oldState,
                oldScore,
                action
            );

            return;
        }


        // =============================================================
        // CALCULATE NEXT STATE
        // =============================================================

        var nextState =
            this.getStateVector();


        if (!nextState)
            nextState = oldState;


        // =============================================================
        // TERMINAL
        // =============================================================

        var done =
            isGameOver ||
            isLevelComplete;


        var reward = 0;


        // =============================================================
        // LEVEL COMPLETE
        // =============================================================

        if (isLevelComplete) {

            reward = 50;

            console.log(
                "[AI EVENT] LEVEL COMPLETE",
                {
                    reward: reward,
                    done: true
                }
            );
        }


        // =============================================================
        // GAME OVER
        // =============================================================

        else if (isGameOver) {

            reward = -10;

            console.log(
                "[AI EVENT] GAME OVER",
                {
                    reward: reward,
                    done: true
                }
            );
        }


        // =============================================================
        // GHOST EATEN
        // =============================================================

        else if (scoreReward >= 200) {

            reward = 10;

            console.log(
                "[AI EVENT] GHOST_EATEN",
                {
                    scoreChange: scoreReward,
                    reward: reward
                }
            );
        }


        // =============================================================
        // ENERGIZER
        // =============================================================

        else if (scoreReward === 50) {

            reward = 5;

            console.log(
                "[AI EVENT] ENERGIZER",
                {
                    scoreChange: scoreReward,
                    reward: reward
                }
            );
        }


        // =============================================================
        // PELLET
        // =============================================================

        else if (scoreReward === 10) {

            reward = 1;

            console.log(
                "[AI EVENT] PELLET",
                {
                    scoreChange: scoreReward,
                    reward: reward
                }
            );
        }


        // =============================================================
        // MOVEMENT / BLOCKED
        // =============================================================

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

                console.log(
                    "[AI EVENT] BLOCKED",
                    {
                        action: action,
                        reward: reward
                    }
                );

            } else {

                reward = 0;

                console.log(
                    "[AI EVENT] MOVE",
                    {
                        reward: reward
                    }
                );
            }
        }


        // =============================================================
        // GHOST DISTANCE SHAPING
        //
        // Only during normal gameplay.
        // =============================================================

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

                // State layout:
                //
                // Base = 10
                //
                // Ghost i:
                // dx       = 10 + i*5
                // dy       = 11 + i*5
                // dist     = 12 + i*5
                // scared   = 13 + i*5
                // dangerous= 14 + i*5

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


        // =============================================================
        // SEND TRANSITION
        // =============================================================

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


        // =============================================================
        // NORMAL STEP
        // =============================================================

        if (!done) {

            this.waitUntilPlayable(
                function () {

                    neuralAI.sendState();
                }
            );

            return;
        }


        // =============================================================
        // TERMINAL
        //
        // Python server will send RESET.
        // Do NOT reset here.
        // =============================================================

        console.log(
            "Terminal transition sent. Waiting for Python reset."
        );
    },


    // =========================================================================
    // CONTROLLED DEATH WAIT
    // =========================================================================

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


            // -------------------------------------------------------------
            // Game already moved to game-over
            // -------------------------------------------------------------

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


            // -------------------------------------------------------------
            // Still in death animation
            // -------------------------------------------------------------

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


            // -------------------------------------------------------------
            // Death sequence finished
            // -------------------------------------------------------------

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


    // =========================================================================
    // NORMAL DEATH TRANSITION
    // =========================================================================

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


        // If the game is no longer in overState,
        // check whether there are no lives remaining.
        if (!done) {

            if (
                typeof extraLives !==
                "undefined" &&
                extraLives === 0
            ) {

                done = true;
            }
        }


        // A death should always produce negative reward.
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


        // -------------------------------------------------------------
        // If this was only a lost life, continue after restart.
        // -------------------------------------------------------------

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


    // =========================================================================
    // FORCED DEATH TRANSITION
    // =========================================================================

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


// ============================================================================
// AUTOMATIC START
// ============================================================================

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


                    // =========================================================
                    // GAME NEEDS START
                    // =========================================================

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


                    // =========================================================
                    // ALREADY PLAYING
                    // =========================================================

                    if (
                        gameState ===
                        playState
                    ) {

                        neuralAI.waitingForReset =
                            false;

                        neuralAI.sendState();

                        return;
                    }


                    // =========================================================
                    // OTHERWISE WAIT
                    // =========================================================

                    setTimeout(
                        checkAndStart,
                        100
                    );
                };


            // Give game engine time to initialize.
            setTimeout(
                checkAndStart,
                500
            );
        }
    );
}