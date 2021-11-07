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
        const offset = convertMouseToWorld({clientX: this.mouseX, clientY: this.mouseY});
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
        this.p.innerHTML = `(${offsetX | 0}, ${offsetY | 0})`;
    }
}

class KeyToggler extends Set {
    constructor() {
        super();

        this.add('KeyH');

        window.addEventListener("keypress", e => {
            if (this.has(e.code)) {
                this.delete(e.code);
            } else {
                this.add(e.code);
            }
        })
    }
}

class KeyPresser extends Set {
    #callbacks = new Map();

    constructor() {
        super();
        window.addEventListener("keydown", e => {
            if (e.code === "Tab") e.preventDefault();

            if (this.#callbacks.has(e.code)) {
                this.#callbacks.get(e.code)();
            } else {
                this.add(e.code);
            }
        })

        window.addEventListener("keyup", e => {
            this.delete(e.code);
        })
    }

    register(key, cb) {
        this.#callbacks.set(key, cb);
    }

    pressed(key) {
        return this.delete(key);
    }
}

const keysToggled = new KeyToggler();
const keysPressed = new KeyPresser();

const initWidth = RES_W;

class MapMover {
    offsetX = 0
    offsetY = 0
    scale = 1

    resetView() {
        this.offsetX = this.offsetY = 0;
    }

    constructor() {
        keysPressed.register('KeyV', () => this.resetView());

        window.addEventListener('mousewheel', e => {
            if (!globals.visuals) return;
            const RATIO = 16 / 9;

            this.scale += e.deltaY / 500;
            RES_W = initWidth * this.scale;
            RES_H = RES_W / RATIO;
            globals.visuals.updateRes();
        })

        window.addEventListener('mousemove', ({movementX, movementY}) => {
            if (!('ShiftLeft' in globals.game.keyStates)) return;
            this.offsetX -= movementX * this.scale;
            this.offsetY -= movementY * this.scale;
        });
    }
}

class StateDisplayer {
    #ele;
    #lastState;

    constructor() {
        this.#ele = document.createElement('div');
        this.#ele.style.position = 'absolute';
        this.#ele.style.right = this.#ele.style.bottom = '10%';
        this.#ele.style.color = 'white';
        this.#ele.style.fontSize = '2em';
        this.#ele.style.textAlign = 'right';
        document.getElementById('hud').append(this.#ele);
    }

    refresh() {
        let state;
        if (!keysToggled.has('KeyH')) {
            state = 'Live';
        } else if (keysToggled.has('KeyT')) {
            state = 'Committing';
        } else if (globals.game.paused) {
            state = `Paused<br>${globals.game.getRate().toFixed(1)}x`;
        } else {
            state = `Simulating<br>${globals.game.getRate().toFixed(1)}x`;
        }
        if (state !== this.#lastState) {
            this.#ele.innerHTML = this.#lastState = state;
        }
    }
}

class ProxyVisuals extends visuals.Visuals {
    mouseDisplay = new MouseDisplay();
    mapMover = new MapMover();
    challengeLink = new Map();
    receptacleLink = new Map();

    initializeCanvases() {
        super.initializeCanvases();
    }

    updateRes() {
        if (this.elEntities != null) {
            this.elEntities.width = RES_W;
            this.elEntities.height = RES_H;
        }
        this.elFront.forEach(el => {
            el.style.width = `${100 * el.width / RES_W}%`
            el.style.height = `${100 * el.height / RES_H}%`
        })
    }

    renderEntity(e) {
        const ret = super.renderEntity(e);
        const skipCheck = [
            "Terminal", "FlagConsole", "Portal", "Key", "KeyReceptacle", "Door"
        ].includes(e.type);

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

        ctx.lineWidth = this.mapMover.scale;
        if (e.type === "Key") {
            if (!e.pickupAble) return;
            const {x, y} = globals.state.state.entities.player;
            const {tileW, tileH} = globals.map.framesets.player.tileset;
            ctx.strokeStyle = 'green';
            ctx.beginPath();
            ctx.moveTo(x + tileW / 2 - xOffset, y + tileH / 2 - yOffset);
            ctx.lineTo(e.x + tile.tileW / 2 - xOffset, e.y + tile.tileH / 2 - yOffset);
            ctx.stroke();
        } else if (e.type === "KeyReceptacle") {
            const midX = e.x + tile.tileW / 2, midY = e.y + tile.tileH / 2;
            e.subscribers?.forEach(sub => {
                this.receptacleLink.set(sub, [midX, midY]);
            });
        } else if (e.type === "Door") {
            if (this.receptacleLink.has(e.id)) {
                const midX = e.x + tile.tileW / 2, midY = e.y + tile.tileH / 2;
                const [x, y] = this.receptacleLink.get(e.id);

                ctx.strokeStyle = 'orange';
                ctx.beginPath();
                ctx.moveTo(midX - xOffset, midY - yOffset);
                ctx.lineTo(x - xOffset, y - yOffset);
                ctx.stroke();
            }
        } else if (e.type === "Terminal" || e.type === "FlagConsole") {
            const chal = e.challengeID;
            const midX = e.x + tile.tileW / 2, midY = e.y + tile.tileH / 2;
            if (this.challengeLink.has(chal)) {
                const [oMidX, oMidY] = this.challengeLink.get(chal);
                this.challengeLink.delete(chal);

                ctx.strokeStyle = 'white';
                ctx.beginPath();
                ctx.moveTo(midX - xOffset, midY - yOffset);
                ctx.lineTo(oMidX - xOffset, oMidY - yOffset);
                ctx.stroke();
            } else {
                this.challengeLink.set(chal, [midX, midY]);
            }
        } else if (e.type === "Portal") {
            const midX = e.x + tile.tileW / 2, midY = e.y + tile.tileH / 2;
            ctx.fillStyle = 'magenta';
            ctx.beginPath();
            ctx.arrow(midX - xOffset, midY - yOffset,
                e.target.x - xOffset, e.target.y - yOffset,
                [0, this.mapMover.scale / 2, -10, this.mapMover.scale / 2, -10, 5]);
            ctx.fill();
        }

        if (outView) return;

        const x = e.x - xOffset;
        const y = e.y - yOffset;

        tile.collisions.forEach(c => {
            const gredient = this.elContext.createLinearGradient(
                x + c.x, y + c.y, x + c.x + c.width, y + c.y + c.height);
            gredient.addColorStop(0, 'blue');
            gredient.addColorStop(1, 'yellow');
            ctx.strokeStyle = gredient;
            ctx.strokeRect(x + c.x, y + c.y, c.width, c.height);
        });

        if (keysToggled.has('KeyB')) {
            ctx.strokeStyle = ctx.fillStyle = 'red';
            ctx.font = '16px monospace';
            ctx.textBaseline = 'bottom';
            ctx.fillText(e.id, x, y + tile.tileH);

            ctx.textBaseline = 'top';
            const titleText = ['FlagConsole', 'Terminal'].includes(e.type) ? (e.type + ': ' + e.challengeID) : e.type;
            ctx.fillText(titleText, x, y);

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
                if (c.type) return;
                const gredient = this.elContext.createLinearGradient(
                    x + c.x, y + c.y, x + c.x + c.width, y + c.y + c.height);
                gredient.addColorStop(0, 'blue');
                gredient.addColorStop(1, 'yellow');
                ctx.strokeStyle = gredient;
                ctx.strokeRect(x + c.x, y + c.y, c.width, c.height);
            });
        })

        const deathZones = globals.map.layers.metadata.getObjectsByType("death");
        ctx.fillStyle = "rgba(255, 0, 0, 0.7)";
        deathZones.forEach(({x, y, width, height}) => {
            ctx.fillRect(x, y, width, height);
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
    simulatedStates = [];
    simulateStateIndex = 0;
    stateDisplay = new StateDisplayer();
    accelerate = 1;
    paused = false;

    #navigate() {
        const {mouseX, mouseY} = globals.visuals.mouseDisplay;
        const offset = convertMouseToWorld({clientX: mouseX, clientY: mouseY});
        if (!offset) return;
        const navi = navigate(...offset);
        if (!navi) {
            document.body.style.cursor = "not-allowed";
            return;
        }
        while (navi.length > 0) {
            this.simulatedStates = this.simulatedStates.splice(
                0, this.simulateStateIndex++);
            const inputs = navi.shift();
            globals.state.tick(inputs);
            this.simulatedStates.push([globals.state.oldState, inputs]);
        }
        globals.visuals.mapMover.resetView();
    }

    #visualRender() {
        if ('KeyZ' in this.keyStates) {
            if (this.simulateStateIndex > 0) {
                globals.state.state = this.simulatedStates[--this.simulateStateIndex][0];
            }
            this.paused = true;
            return;
        }
        if ('KeyX' in this.keyStates) {
            if (this.simulateStateIndex < this.simulatedStates.length - 1) {
                globals.state.state = this.simulatedStates[++this.simulateStateIndex][0];
            }
            this.paused = true;
            return;
        }

        if ("KeyW" in this.keyStates || "ArrowUp" in this.keyStates ||
            "KeyA" in this.keyStates || "ArrowLeft" in this.keyStates ||
            "KeyS" in this.keyStates || "ArrowDown" in this.keyStates ||
            "KeyD" in this.keyStates || "ArrowRight" in this.keyStates ||
            "Space" in this.keyStates || this.auxiliaryInputQueue.length > 0) {
            this.paused = false;
        } else {
            const player = globals.state.state.entities.player;
            if (player.canJump && player.moveV === 0) {
                this.paused = true;
                return;
            }
        }

        if (!("KeyK" in this.keyStates) &&
            !this.paused) {
            this.simulatedStates = this.simulatedStates.splice(
                0, this.simulateStateIndex++);

            const inputs = this.processInputs();
            globals.state.tick(inputs);
            this.simulatedStates.push([globals.state.oldState, inputs]);
        }
    }

    getRate() {
        return ('ControlLeft' in this.keyStates) ? 3 : this.accelerate;
    }

    #simulate() {
        if (keysPressed.pressed('Backquote'))
            this.#navigate();

        const now = Date.now();
        if (keysToggled.has('KeyT')) {
            // commit
            const maxPossibleTickNumber = (
                ProxyGame.connectionStartTick +
                (now - ProxyGame.connectionStartTime) * gameState.TICKS_PER_SECOND / 1000
            ) | 0; // from server logic

            this.paused = true;
            if (globals.state.state.tick < maxPossibleTickNumber) {
                keysToggled.delete('KeyT');
                const changes = [];
                for (let i = 0; i < this.simulateStateIndex; ++i) {
                    const [s, inp] = this.simulatedStates[i];
                    let diff;
                    if (i === this.simulateStateIndex - 1) {
                        diff = utils.computeDiff(globals.state.state, s);
                    } else {
                        diff = utils.computeDiff(this.simulatedStates[i + 1][0], s);
                    }
                    changes.push({inputs: inp, state: diff});
                }
                if (changes.length > 0) {
                    main.wsSend({
                        type: "ticks",
                        changes: changes
                    });
                }
                this.simulatedStates = this.simulatedStates.splice(this.simulateStateIndex);
                this.simulateStateIndex = 0;
            }
            return;
        }

        if (keysPressed.pressed('Comma') && this.accelerate > 0) {
            this.accelerate -= .1;
        } else if (keysPressed.pressed('Period')) {
            this.accelerate += .1;
        }

        if (now < this.lastTickTime + gameState.MS_PER_TICK / this.getRate()) return;

        this.#visualRender();
        this.lastTickTime = Date.now();
        globals.visuals.render();
    }

    iterate(onlyLogic = false) {
        this.stateDisplay.refresh();

        if (!keysToggled.has('KeyH')) {
            if (this.simulatedStates.length > 0) {
                if (!confirm("还有未提交的更改，确定回退吗？")) {
                    keysToggled.add('KeyH');
                    this.frameRequestID = window.requestAnimationFrame(() => {
                        this.iterate()
                    });
                    return;
                }
                globals.state.state = this.simulatedStates[0][0];
                this.simulatedStates = [];
            }
            this.simulateStateIndex = 0;
            return super.iterate(onlyLogic);
        }
        if (onlyLogic) return;
        this.#simulate();

        /* copied from code */
        this.frameRequestID = window.requestAnimationFrame(() => {
            this.iterate()
        });
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
        case "terminal":
            if (data.data) terminalRedir.send(data.data);
            break;
    }

    return oldWsOnMsg(e);
}

function convertMouseToWorld({clientX, clientY}) {
    const canvas = globals.visuals?.elEntities;
    if (!canvas) return;
    const {x, y, width, height} = canvas.getBoundingClientRect();
    const offsetX = (clientX - x) / width * RES_W, offsetY = (clientY - y) / height * RES_H;
    if (offsetX < 0 || offsetX >= RES_W || offsetY < 0 || offsetY >= RES_H) return;
    const {viewportX, viewportY} = globals.visuals;
    return [offsetX + viewportX, offsetY + viewportY];
}

// copied from source
function playerTick(state, input) {
    const gravity = 31.2 * gameState.SEC_PER_TICK

    const currentX = this.x
    const currentY = this.y

    if ("right" in input) {
        if (this.moveV < 0) {
            this.moveV = 0  // Reset to 0 if was going the other way.
        }

        this.moveV = Math.min(
            this.maxMovementSpeed, this.moveV + this.accelerationSpeed
        )
    } else if ("left" in input) {
        if (this.moveV > 0) {
            this.moveV = 0  // Reset to 0 if was going the other way.
        }

        this.moveV = Math.max(
            -this.maxMovementSpeed, this.moveV - this.accelerationSpeed
        )
    } else {
        if (this.moveV > 0) {
            this.moveV = Math.max(0, this.moveV - this.stopSpeed)
        } else {
            this.moveV = Math.min(0, this.moveV + this.stopSpeed)
        }
    }

    // Allow jumps only if the player is on the ground at least one tick without
    // holding the UP arrow.
    if (!this.canJump && this.solidGround && !("up" in input)) {
        this.canJump = true
    }

    if (this.canJump && !this.solidGround) {
        this.canJump = false
    }

    if (this.canJump) {
        this.jumpV = this.pushGravity  // Push player into the ground.
        if (("up" in input) && (this.jumpProgress == -1)) {
            this.jumpProgress = 0  // Start the jump;
        }

    } else {
        this.jumpV = Math.min(this.maxFallSpeed, this.jumpV + gravity)
    }

    if ("up" in input) {
        if (this.jumpProgress != -1 && this.jumpProgress < this.jumpForceCurve.length) {
            var oldUp = this.jumpV
            this.jumpV -= this.jumpForceCurve[this.jumpProgress] + gravity
            this.jumpProgress++;
        }
    } else {
        this.jumpProgress = -1
    }

    // Tick the animation engine to potentially update the frame.
    entities.animationEngines.Character.tick.call(this, state)

    if (this.frameSet === undefined) {
        throw "Animated object doesn't have a frameSet. Did you remember to set the is_frameset property on the tileset?"
    }

    const currentFrame = state.map.framesets[this.frameSet].getFrame(
        this.frameState, this.frame
    )

    // TODO: calculatePotentialMove should actually both get the frame,
    // and return whether "gravity" collision was hit.
    const [
        newPosition, solidGround, collidingEntities
    ] = state.calculatePotentialMove(
        [currentX, currentY],
        [this.moveV, this.jumpV],
        currentFrame.tile,
        [this.id]  // Exclude this entity from colliding with itself.
    )

    this.x = newPosition[0]
    this.y = newPosition[1]
    this.solidGround = solidGround

    // In case it wasn't possible to move vertically the whole way, cut the
    // jump velocity.
    // TODO: Just return the case from calculatePotentialMove instead of this
    // check.
    if (this.y !== currentY + this.jumpV && this.jumpV < 0) {
        this.jumpV = 0
    }
}

// Greedy Best First Search

let searchTimeout = 2000;

function navigate(targetX, targetY) {
    const endTime = Date.now() + searchTimeout;

    const getPosition = player => {
        const {tile} = globals.map.framesets[player.frameSet].getFrame(player.frameState, player.frame);
        const box = tile.collisions[0];
        const x = box.x + player.x, y = box.y + player.y;
        return [x + box.width / 2, y + box.height / 2];
    }

    const stateTpl = globals.state;
    const player = stateTpl.state.entities['player'];
    const distance = new Map();
    const granularity = 16;

    const heuristic = player => {
        // const [x, y] = getPosition(player);
        // const gridX = x / granularity | 0, gridY = y / granularity | 0;
        // const dist = distance.get(`${gridX},${gridY}`);
        // if (dist) return dist + Math.hypot(x - (gridX + .5) * granularity, y - (gridY + .5) * granularity);
        const {tile} = globals.map.framesets[player.frameSet].getFrame(player.frameState, player.frame);
        const box = tile.collisions[0];
        const x = box.x + player.x, y = box.y + player.y;
        const targetDis = Math.hypot(x + box.width / 2 - targetX, y + box.height / 2 - targetY)
        if (targetDis < 64) return targetDis / granularity * 0.6
        let min = Infinity;
        const cx = granularity * 12
        const cy = granularity * 4
        for (let i = -cx; i < box.width + cx; i += granularity) {
            for (let j = -cy; j < box.height + cy; j += granularity) {
                const gridX = (x + i) / granularity | 0, gridY = (y + j) / granularity | 0;
                const coord = `${gridX},${gridY}`
                if (distance.has(coord)) {
                    const xt = (gridX + .5) * granularity - x
                    const yt = (gridY + .5) * granularity - y
                    min = Math.min(min, distance.get(coord) + Math.hypot(Math.max(-xt, xt - box.width, 0), Math.max(-yt, yt - box.height, 0)) / granularity);
                }
            }
        }
        return min === Infinity ? undefined : min;
    }

    const hashPlayer = player => {
        const {tile} = globals.map.framesets[player.frameSet].getFrame(player.frameState, player.frame);
        const box = tile.collisions[0];
        const x = box.x + player.x, y = box.y + player.y;
        const targetDis = Math.hypot(x + box.width / 2 - targetX, y + box.height / 2 - targetY)
        const step = targetDis >= 64 ? 4 : 0.1;
        return `${Math.floor(player.x / step) * step},${Math.floor(player.y / step) * step}`;
    }

    const playerCoord = getPosition(player);
    const playerCoordX = playerCoord[0] / granularity | 0, playerCoordY = playerCoord[1] / granularity | 0;
    { // 1st part, a*
        const boundX = globals.map.canvasW / granularity | 0, boundY = globals.map.canvasH / granularity | 0;
        const tX = targetX / granularity | 0, tY = targetY / granularity | 0;
        const queue = [[Math.abs(playerCoordX - tX) + Math.abs(playerCoordY - tY), tX, tY]];
        const visited = new Set();
        const heightCache = new Map();
        const height = (x, y, limit = 50) => {
            if (!limit) return 0
            if (x < 0 || x >= boundX || y < 0 || y >= boundY) return 0
            const coord = `${x},${y}`
            if (heightCache.has(coord))
                return heightCache.get(coord)
            const bounding = [
                (x + .5) * granularity,
                (y + .5) * granularity,
                1e-9,
                granularity,
            ];
            const mapRects = globals.map.getCollisionRectsForArea(...bounding);
            if (mapRects.length > 0) {
                heightCache.set(coord, 0)
                return 0
            }
            const [hardRects,] = stateTpl.getEntityCollisionRectsForArea(
                ...bounding, [player.id]
            );
            if (hardRects.length > 0) {
                heightCache.set(coord, 0)
                return 0
            }
            const res = height(x, y + 1, limit - 1) + 1
            heightCache.set(coord, res)
            return res
        };
        for (let i = -1; i <= 1; i++)
            for (let j = -1; j <= 1; j++)
                distance.set(`${tX + i},${tY + j}`, 0);
        while (queue.length > 0) {
            if (Date.now() > endTime) return;
            const [, frontX, frontY] = MinHeap.pop(queue);
            if (Math.hypot(frontX - playerCoordX, frontY - playerCoordY) < 3) break;

            const coord = `${frontX},${frontY}`;
            if (visited.has(coord)) continue;
            visited.add(coord);
            const dist = distance.get(coord);

            [
                [0, 1], [0, -1], [1, 0], [-1, 0],
                [12, 0], [-12, 0],
                [0, 4], [0, -4],
            ].forEach(([dx, dy]) => {
                const newX = frontX + dx, newY = frontY + dy;
                if (newX < 0 || newX >= boundX || newY < 0 || newY >= boundY) return;
                const bounding = [
                    (Math.min(newX, frontX) + .5) * granularity,
                    (Math.min(newY, frontY) + .5) * granularity,
                    Math.abs(dx) * granularity || 1e-9,
                    Math.abs(dy) * granularity || 1e-9,
                ];
                const mapRects = globals.map.getCollisionRectsForArea(...bounding);
                if (mapRects.length > 0) return;
                const [hardRects,] = stateTpl.getEntityCollisionRectsForArea(
                    ...bounding, [player.id]
                );
                if (hardRects.length > 0) return;

                let len = Math.hypot(dx, dy);
                len += Math.pow(Math.min(32, height(newX, newY)), 1.7) // give a punish for flying
                const newLength = dist + len;
                const newCoord = `${newX},${newY}`;
                if (!distance.has(newCoord) || distance.get(newCoord) > newLength) {
                    distance.set(newCoord, newLength);
                    MinHeap.push(queue, [
                        newLength +
                        Math.hypot(playerCoordX - newX, playerCoordY - newY) * 5.5, newX, newY]); // make A* (almostly) consistent
                }
            });
        }
    }
    const initDist = heuristic(player);
    console.log('time: ' + (Date.now() - (endTime - searchTimeout)) + ', initDist: ' + initDist)
    if (!initDist) return;

    const possibleActions = [
        {},
        {'left': true},
        {'right': true},
        {'up': true},
        {'up': true, 'left': true},
        {'up': true, 'right': true},
    ];

    const parent = new Map();
    const queue = [[initDist, stateTpl.state.tick, player]];
    parent.set(hashPlayer(player), null);
    const pressingLength = 5;
    const gs = new gameState.GameState(globals.map);

    while (queue.length > 0) {
        if (Date.now() > endTime) return;
        let [, curTick, player] = MinHeap.pop(queue);

        const coord = hashPlayer(player);
        {
            const {tile} = globals.map.framesets[player.frameSet].getFrame(player.frameState, player.frame);
            const box = tile.collisions[0];
            const x = box.x + player.x, y = box.y + player.y;
            if (x <= targetX && targetX < x + box.width &&
                y <= targetY && targetY < y + box.height) {
                let actions = [];
                let cur = coord;
                while (parent.get(cur) !== null) {
                    const [prev, action] = parent.get(cur);
                    for (let i = 0; i < pressingLength; i++) actions.unshift(action);
                    cur = prev;
                }
                console.log(Date.now() - (endTime - searchTimeout))
                return actions;
            }
        }

        possibleActions.forEach(action => {
            const newPlayer = utils.simpleDeepCopy(player);
            for (let i = 1; i <= pressingLength; i++) {
                gs.state = {tick: curTick + i, entities: globals.state.state.entities};
                playerTick.call(newPlayer, gs, action);
            }
            const newCoord = hashPlayer(newPlayer);
            if (!parent.has(newCoord)) {
                const newH = heuristic(newPlayer);
                if (newH) {
                    parent.set(newCoord, [coord, action]);
                    MinHeap.push(queue, [newH, curTick + pressingLength, newPlayer]);
                }
            }
        })
    }
}

document.addEventListener('mousemove', function (e) {
    if (!globals.visuals) return;
    document.body.style.removeProperty("cursor");
    const disp = globals.visuals.mouseDisplay;
    disp.mouseX = e.clientX;
    disp.mouseY = e.clientY;
});

window.addEventListener('beforeunload', function (e) {
    e.preventDefault();
    return e.returnValue = 'dont close'
});

class TerminalRedir {
    constructor() {
        this.reconnect()
    }

    reconnect() {
        const loc = document.location;
        const protocol = loc.protocol === "http:" ? "ws:" : "wss:";
        this.ws = new WebSocket(`${protocol}//${loc.host}/aux`);
        this.ws.onmessage = e => {
            globals.game.auxiliaryInputQueue.push({
                type: "terminal",
                value: e.data,
            })
        }
        this.ws.onclose = () => {
            setTimeout(() => {
                this.reconnect()
            }, 500)
        }
    }

    send(data) {
        this.ws.send(data);
    }
}

const terminalRedir = new TerminalRedir();

function closeFloat() {
    const {terminals, flagConsoles, gameSaver} = globals.game;
    terminals.forEach(e => {
        e.hide()
    });
    flagConsoles.forEach(e => {
        e.hide()
    });
    gameSaver.hide();
}

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

