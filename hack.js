// Hackceler8 Game Tools
// Tea Deliverers

'use strict';

function resize() {
    const RATIO = 16 / 9;

    RES_W = window.innerWidth;
    RES_H = RES_W / RATIO;
    if (RES_H > window.innerHeight) {
        RES_H = window.innerHeight;
        RES_W = RES_H * RATIO;
    }
    if (globals.map) {
        globals.visuals.initialize(globals.map);
    }
}

resize();
window.addEventListener('resize', resize);

class MouseDisplay {
    mouseX;
    mouseY;
    lastX;
    lastY;

    constructor() {
        this.p = document.createElement('p');
        this.p.style.position = 'absolute';
        this.p.style.color = 'white';
        this.p.style.fontSize = '1vw';
        this.p.style.transform = 'translate(0.2vw, -2vw)';
        this.p.style.userSelect = 'none';
        document.body.append(this.p);
    }

    update() {
        const offset = convertMouseToCanvas({clientX: this.mouseX, clientY: this.mouseY});
        if (!offset) return;
        const [offsetX, offsetY] = offset;
        if (offsetX === this.lastX && offsetY === this.lastY) return;
        this.lastX = offsetX;
        this.lastY = offsetY;

        this.p.style.left = `${this.mouseX}px`;
        this.p.style.top = `${this.mouseY}px`;
        this.p.innerText = `(${offsetX.toFixed(0)}, ${offsetY.toFixed(0)})`;
    }
}

class ProxyVisuals extends visuals.Visuals {
    mouseDisplay = new MouseDisplay();
    challengeLink = new Map();

    renderEntity(e) {
        const ret = super.renderEntity(e);
        const skipCheck = e.type === "Terminal" || e.type === "FlagConsole";

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

        const xOffset = (globals.state.state.entities.player.x - (RES_W / 2));
        const yOffset = (globals.state.state.entities.player.y - (RES_H / 2));

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

    if (data.type === "map") {
        ProxyGame.connectionStartTime = Date.now();
    } else if (data.type === "startState") {
        ProxyGame.connectionStartTick = data.state.tick;
    }

    return oldWsOnMsg(e);
}

function convertMouseToCanvas({clientX, clientY}) {
    const canvas = globals.visuals?.elEntities;
    if (!canvas) return;
    const {x, y} = canvas.getBoundingClientRect();
    const offsetX = clientX - x, offsetY = clientY - y;
    if (offsetX < 0 || offsetX >= canvas.width || offsetY < 0 || offsetY >= canvas.height) return;
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
