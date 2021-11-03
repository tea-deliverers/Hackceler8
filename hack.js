// Hackceler8 Game Tools
// Tea Deliverers

'use strict';

// function resize() {
//     const RATIO = 16 / 9;
//
//     RES_W = window.innerWidth;
//     RES_H = RES_W / RATIO;
//     if (RES_H > window.innerHeight) {
//         RES_H = window.innerHeight;
//         RES_W = RES_H * RATIO;
//     }
//     if (globals.map) {
//         globals.visuals.initialize(globals.map);
//     }
// }
//
// resize();
// window.addEventListener('resize', resize);

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

        ctx.strokeStyle = ctx.fillStyle = 'red';
        ctx.font = '16px monospace';
        ctx.textBaseline = 'bottom';
        ctx.fillText(e.id, x, y + tile.tileH);

        ctx.textBaseline = 'top';
        ctx.fillText(e.type, x, y);

        ctx.strokeRect(x, y, tile.tileW, tile.tileH);
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

document.addEventListener('click', function (e) {
    const offset = convertMouseToCanvas(e);
    if (!offset) return;
    const [offsetX, offsetY] = offset;

    console.log(offsetX, offsetY);
});

document.addEventListener('mousemove', function (e) {
    if (!globals.visuals) return;
    const disp = globals.visuals.mouseDisplay;
    disp.mouseX = e.clientX;
    disp.mouseY = e.clientY;
});

// github.com/frogcat/canvas-arrow
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
