System.register(["./model", "./rooms"], function (exports_1, context_1) {
    "use strict";
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (model_1_1) {
                exports_1({
                    "GameModel": model_1_1["GameModel"]
                });
            },
            function (rooms_1_1) {
                exports_1({
                    "ROOMS": rooms_1_1["ROOMS"],
                    "TOOLS": rooms_1_1["TOOLS"],
                    "TUNING": rooms_1_1["TUNING"],
                    "JOYSTICK_TUNING": rooms_1_1["JOYSTICK_TUNING"],
                    "ACTION_PACING": rooms_1_1["ACTION_PACING"]
                });
            }
        ],
        execute: function () {
        }
    };
});
