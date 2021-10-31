// Hackceler8 Game Tools
// Tea Deliverers

'use strict';

const FACTOR = 16 / 9;

// RES_W = 1920;
// RES_H = 1080;

function resize() {
    RES_W = window.innerWidth;
    RES_H = RES_W / FACTOR;
    if (globals.map) {
        globals.visuals.initialize(globals.map);
    }
}

resize();
window.addEventListener('resize', resize);

class ProxyVisuals extends visuals.Visuals {
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

        outView |= e.x + tile.tileW < this.viewportX ||
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
}

visuals.Visuals = ProxyVisuals;
