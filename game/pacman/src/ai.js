//////////////////////////////////////////////////////////////////////////////////////
// Neural Pac-Man AI Interface
// basically orchestrates the pacman object to move in a certain direction

var neuralAI = {

    setDirection: function(dirEnum) {

        if (!pacman) {
            console.log("Pac-Man not initialized yet.");
            return;
        }

        pacman.setInputDir(dirEnum);

        console.log("AI action:", dirEnum);
    },

    stop: function() {

        if (!pacman)
            return;

        pacman.clearInputDir();

        console.log("AI stopped.");
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
    }
};