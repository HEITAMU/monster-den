System.register(["cc"], function (exports_1, context_1) {
    "use strict";
    var cc_1, pending;
    var __moduleName = context_1 && context_1.id;
    /** Share a bundle request when model and audio loaders start together. */
    function loadGameBundle(name, timeoutMs = 15000) {
        const ready = cc_1.assetManager.getBundle(name);
        if (ready)
            return Promise.resolve(ready);
        const previous = pending.get(name);
        if (previous)
            return previous;
        const request = new Promise((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => { if (!settled) {
                settled = true;
                reject(new Error(`资源分包 ${name} 加载超时。`));
            } }, Math.max(100, timeoutMs));
            try {
                cc_1.assetManager.loadBundle(name, (error, bundle) => {
                    if (settled)
                        return;
                    settled = true;
                    clearTimeout(timer);
                    if (error)
                        reject(error);
                    else
                        resolve(bundle);
                });
            }
            catch (error) {
                settled = true;
                clearTimeout(timer);
                reject(error);
            }
        });
        pending.set(name, request);
        void request.then(() => pending.delete(name), () => pending.delete(name));
        return request;
    }
    exports_1("loadGameBundle", loadGameBundle);
    return {
        setters: [
            function (cc_1_1) {
                cc_1 = cc_1_1;
            }
        ],
        execute: function () {
            pending = new Map();
        }
    };
});
