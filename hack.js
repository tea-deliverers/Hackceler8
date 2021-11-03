// Hackceler8 Game Tools
// Tea Deliverers

'use strict';

class MouseDisplay {
    mouseX;
    mouseY;
    lastX;
    lastY;

    constructor() {
        this.p = document.createElement('p');
        this.p.style.position = 'absolute';
        this.p.style.color = 'white';
        this.p.style.transform = 'translate(10px, -30px)';
        this.p.style.userSelect = 'none';
        document.body.append(this.p);
    }

    update() {
        const offset = convertMouseToCanvas({clientX: this.mouseX, clientY: this.mouseY});
        if (!offset) {
            this.p.hidden = true;
            return;
        }
        this.p.hidden = false;
        const [offsetX, offsetY] = offset;
        if (offsetX === this.lastX && offsetY === this.lastY) return;
        this.lastX = offsetX;
        this.lastY = offsetY;

        this.p.style.left = `${this.mouseX}px`;
        this.p.style.top = `${this.mouseY}px`;
        this.p.innerText = `(${offsetX.toFixed(0)}, ${offsetY.toFixed(0)})`;
    }
}

class KeyToggler extends Set {
    constructor() {
        super();

        window.addEventListener("keypress", e => {
            if (this.has(e.code)) {
                this.delete(e.code);
            } else {
                this.add(e.code);
            }
        })
    }
}

const keysToggled = new KeyToggler();

const initWidth = RES_W;

class MapMover {
    offsetX = 0
    offsetY = 0
    #scale = 1
    #shiftDown = false

    constructor() {
        window.addEventListener('keydown', e => {
            switch (e.code) {
                case "ShiftLeft":
                    this.#shiftDown = true;
                    break;
                case "KeyV":
                    this.offsetX = this.offsetY = 0;
                    break;
            }
        })

        window.addEventListener('keyup', e => {
            switch (e.code) {
                case "ShiftLeft":
                    this.#shiftDown = false;
            }
        })

        window.addEventListener('mousewheel', e => {
            if (!globals.visuals) return;
            const RATIO = 16 / 9;

            this.#scale += e.deltaY / 500;
            RES_W = initWidth * this.#scale;
            RES_H = RES_W / RATIO;
            globals.visuals.updateRes();
        })

        window.addEventListener('mousemove', ({movementX, movementY}) => {
            if (!this.#shiftDown) return;
            this.offsetX -= movementX;
            this.offsetY -= movementY;
        });
    }
}

class ProxyVisuals extends visuals.Visuals {
    mouseDisplay = new MouseDisplay();
    mapMover = new MapMover();
    challengeLink = new Map();

    updateRes() {
        this.elEntities.width = RES_W;
        this.elEntities.height = RES_H;
        this.elFront.forEach(el => {
            el.style.width = `${100 * el.width / RES_W}%`
            el.style.height = `${100 * el.height / RES_H}%`
        })
    }

    renderEntity(e) {
        const ret = super.renderEntity(e);
        const skipCheck = ["Terminal", "FlagConsole", "Portal"].includes(e.type);

        /** copied from source --> **/
        let outView = e.x > this.viewportX + RES_W ||
            e.y > this.viewportY + RES_H ||
            e.x < this.viewportX - 64 ||
            e.y < this.viewportY - 64;

        if (!skipCheck && outView) return;

        const frameset = e.frameSet
        const tile = frameset ? globals.map.framesets[frameset].getFrame(e.frameState, e.frame).tile : globals.map.globalTiles[e.tileGID];

        if (!tile) {
            console.warn("Entity missing frameSet or tileGID:", e);
            return false
        }

        outView ||= e.x + tile.tileW < this.viewportX ||
            e.y + tile.tileH < this.viewportY;

        if (!skipCheck && outView) return;

        const xOffset = this.viewportX;
        const yOffset = this.viewportY;

        const ctx = this.elContext;
        /** <-- copied from source **/

        if (e.type === "Terminal" || e.type === "FlagConsole") {
            const chal = e.challengeID;
            const midX = e.x + tile.tileW / 2, midY = e.y + tile.tileH / 2;
            if (this.challengeLink.has(chal)) {
                const [oMidX, oMidY] = this.challengeLink.get(chal);
                this.challengeLink.delete(chal);

                ctx.strokeStyle = chal.substr(5);
                ctx.beginPath();
                ctx.moveTo(midX - xOffset, midY - yOffset);
                ctx.lineTo(oMidX - xOffset, oMidY - yOffset);
                ctx.stroke();
            } else {
                this.challengeLink.set(chal, [midX, midY]);
            }
        }

        if (e.type === "Portal") {
            const midX = e.x + tile.tileW / 2, midY = e.y + tile.tileH / 2;
            ctx.fillStyle = 'magenta';
            ctx.beginPath();
            ctx.arrow(midX - xOffset, midY - yOffset,
                e.target.x - xOffset, e.target.y - yOffset,
                [0, 0.5, -10, 0.5, -10, 5]);
            ctx.fill();
        }

        if (outView) return;

        const x = e.x - xOffset;
        const y = e.y - yOffset;

        tile.collisions.forEach(c => {
            ctx.strokeStyle = ctx.fillStyle = 'black';
            ctx.strokeRect(x + c.x, y + c.y, c.width, c.height);
        });

        if (keysToggled.has('KeyB')) {
            ctx.strokeStyle = ctx.fillStyle = 'red';
            ctx.font = '16px monospace';
            ctx.textBaseline = 'bottom';
            ctx.fillText(e.id, x, y + tile.tileH);

            ctx.textBaseline = 'top';
            ctx.fillText(e.type, x, y);

            ctx.strokeRect(x, y, tile.tileW, tile.tileH);
        }
        return ret;
    }

    drawTiles(c, layer) {
        const ret = super.drawTiles(c, layer);
        if (layer.name !== "fg0") return ret;

        /** copied from source --> **/
        const ctx = c.getContext("2d");
        const tileW = this.map.tileW;
        const tileH = this.map.tileH;

        layer.tiles.forEach((tile, index) => {
            if (tile === undefined) {
                return;
            }

            const x = (index % this.map.columns) * tileW;
            const y = ((index / this.map.columns) | 0) * tileH;
            /** <-- copied from source **/

            tile.collisions.forEach(c => {
                ctx.strokeRect(x + c.x, y + c.y, c.width, c.height);
            });
        })

        return ret;
    }

    clearPlayerCanvasFast() {
        this.playerCanvasClearRects = [];
        const ctx = this.elContext;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    render() {
        super.render();
        this.mouseDisplay.update();
    }

    setCameraCenterAt(xPixels, yPixels) {
        super.setCameraCenterAt(xPixels + this.mapMover.offsetX, yPixels + this.mapMover.offsetY);
    }
}

visuals.Visuals = ProxyVisuals;

class ProxyGame extends game.Game {
    static connectionStartTick;
    static connectionStartTime;
    pendingInputs = []

    processInputs() {
        if (this.pendingInputs.length > 0) {
            return this.pendingInputs.shift();
        }
        return super.processInputs();
    }

    iterate(onlyLogic = false) {
        /* copied from code */
        const now = Date.now()
        const maxPossibleTickNumber = (
            ProxyGame.connectionStartTick +
            (now - ProxyGame.connectionStartTime) * gameState.TICKS_PER_SECOND / 1000
        ) | 0;
        /* copied from code */

        super.iterate(onlyLogic);
    }
}

game.Game = ProxyGame;

const oldWsOnMsg = main.wsOnMessage;
main.wsOnMessage = function (e) {
    let data = null
    try {
        data = JSON.parse(e.data);
    } catch (ex) {
        console.error("Failed to parse packet from server:", e.data);
        return
    }

    switch (data.type) {
        case "map":
            ProxyGame.connectionStartTime = Date.now();
            break
        case "startState":
            ProxyGame.connectionStartTick = data.state.tick;
            break
    }

    return oldWsOnMsg(e);
}

function convertMouseToCanvas({clientX, clientY}) {
    const canvas = globals.visuals?.elEntities;
    if (!canvas) return;
    const {x, y, width, height} = canvas.getBoundingClientRect();
    const offsetX = (clientX - x) / width * RES_W, offsetY = (clientY - y) / height * RES_H;
    if (offsetX < 0 || offsetX >= RES_W || offsetY < 0 || offsetY >= RES_H) return;
    const {viewportX, viewportY} = globals.visuals;
    return [offsetX + viewportX, offsetY + viewportY];
}

// Greedy Best First Search
function navigate(targetX, targetY) {
    const possibleActions = [
        {'left': true},
        {'right': true},
        {'up': true},
        {'up': true, 'left': true},
        {'up': true, 'right': true},
        {},
    ];
    const startTime = Date.now();

    const heuristic = player => Math.abs(player.x + 47 - targetX) + Math.abs(player.y + 50 - targetY);

    const stateTpl = globals.state.duplicate();
    const parent = new Map();
    const player = stateTpl.state.entities['player'];
    const queue = [[player, stateTpl.state]];
    parent.set(`${player.x}_${player.y}`, null);

    while (Date.now() - startTime < 300 && queue.length > 0) {
        let [, state] = MinHeap.pop(queue);

        const player = state.entities['player'];
        const coord = `${player.x}_${player.y}`;
        {
            const {tile} = stateTpl.map.framesets[player.frameSet].getFrame(player.frameState, player.frame);
            const box = tile.collisions[0];
            const x = box.x + player.x, y = box.y + player.y;
            if (targetX >= x && targetX < x + box.width &&
                targetY >= y && targetY < y + box.height) {
                let actions = [];
                let cur = coord;
                while (parent.get(cur) !== null) {
                    const [prev, action] = parent.get(cur);
                    actions.unshift(action);
                    cur = prev;
                }
                return actions;
            }
        }

        stateTpl.state = state;
        possibleActions.forEach(action => {
            stateTpl.tick(action);
            const newPlayer = stateTpl.state.entities['player'];
            const newCoord = `${newPlayer.x}_${newPlayer.y}`;
            if (!parent.has(newCoord)) {
                parent.set(newCoord, [coord, action]);
                MinHeap.push(queue, [heuristic(newPlayer), stateTpl.state]);
            }
            stateTpl.state = stateTpl.oldState;
        })
    }
}

document.addEventListener('click', function (e) {
    const offset = convertMouseToCanvas(e);
    if (!offset) return;
    if (globals.state?.state && globals.game.pendingInputs.length <= 0) {
        const navi = navigate(...offset);
        if (navi) globals.game.pendingInputs.push(...navi);
    }
});

document.addEventListener('mousemove', function (e) {
    if (!globals.visuals) return;
    const disp = globals.visuals.mouseDisplay;
    disp.mouseX = e.clientX;
    disp.mouseY = e.clientY;
});

// https://github.com/frogcat/canvas-arrow
CanvasRenderingContext2D.prototype.arrow = function (startX, startY, endX, endY, controlPoints) {
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const sin = dy / len;
    const cos = dx / len;
    const a = [];
    a.push(0, 0);
    for (let i = 0; i < controlPoints.length; i += 2) {
        const x = controlPoints[i];
        const y = controlPoints[i + 1];
        a.push(x < 0 ? len + x : x, y);
    }
    a.push(len, 0);
    for (let i = controlPoints.length; i > 0; i -= 2) {
        const x = controlPoints[i - 2];
        const y = controlPoints[i - 1];
        a.push(x < 0 ? len + x : x, -y);
    }
    a.push(0, 0);
    for (let i = 0; i < a.length; i += 2) {
        const x = a[i] * cos - a[i + 1] * sin + startX;
        const y = a[i] * sin + a[i + 1] * cos + startY;
        if (i === 0) this.moveTo(x, y);
        else this.lineTo(x, y);
    }
};

// https://stackoverflow.com/a/66511107
const MinHeap = {
    /* siftDown:
     * The node at the given index of the given heap is sifted down in
     * its subtree until it does not have a child with a lesser value.
     */
    siftDown(arr, i = 0, value = arr[i]) {
        if (i < arr.length) {
            let key = value[0]; // Grab the value to compare with
            while (true) {
                // Choose the child with the least value
                let j = i * 2 + 1;
                if (j + 1 < arr.length && arr[j][0] > arr[j + 1][0]) j++;
                // If no child has lesser value, then we've found the spot!
                if (j >= arr.length || key <= arr[j][0]) break;
                // Copy the selected child node one level up...
                arr[i] = arr[j];
                // ...and consider the child slot for putting our sifted node
                i = j;
            }
            arr[i] = value; // Place the sifted node at the found spot
        }
    },
    /* heapify:
     * The given array is reordered in-place so that it becomes a valid heap.
     * Elements in the given array must have a [0] property (e.g. arrays).
     * That [0] value serves as the key to establish the heap order. The rest
     * of such an element is just payload. It also returns the heap.
     */
    heapify(arr) {
        // Establish heap with an incremental, bottom-up process
        for (let i = arr.length >> 1; i--;) this.siftDown(arr, i);
        return arr;
    },
    /* pop:
     * Extracts the root of the given heap, and returns it (the subarray).
     * Returns undefined if the heap is empty
     */
    pop(arr) {
        // Pop the last leaf from the given heap, and exchange it with its root
        return this.exchange(arr, arr.pop()); // Returns the old root
    },
    /* exchange:
     * Replaces the root node of the given heap with the given node, and
     * returns the previous root. Returns the given node if the heap is empty.
     * This is similar to a call of pop and push, but is more efficient.
     */
    exchange(arr, value) {
        if (!arr.length) return value;
        // Get the root node, so to return it later
        let oldValue = arr[0];
        // Inject the replacing node using the sift-down process
        this.siftDown(arr, 0, value);
        return oldValue;
    },
    /* push:
     * Inserts the given node into the given heap. It returns the heap.
     */
    push(arr, value) {
        let key = value[0],
            // First assume the insertion spot is at the very end (as a leaf)
            i = arr.length,
            j;
        // Then follow the path to the root, moving values down for as long
        // as they are greater than the value to be inserted
        while ((j = (i - 1) >> 1) >= 0 && key < arr[j][0]) {
            arr[i] = arr[j];
            i = j;
        }
        // Found the insertion spot
        arr[i] = value;
        return arr;
    }
};

