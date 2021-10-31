// Hackceler8 Game Tools
// Tea Deliverers

'use strict';

RES_W = 1920;
RES_H = 1080;

class ProxyVisuals extends visuals.Visuals {
    renderEntity(e) {
        const ret = super.renderEntity(e);

        /** copied from source --> **/
        if (e.x > this.viewportX + RES_W ||
            e.y > this.viewportY + RES_H) {
            return false
        }

        if (e.x < this.viewportX - 64 ||
            e.y < this.viewportY - 64) {
            return false
        }

        const frameset = e.frameSet
        const tile = frameset ? globals.map.framesets[frameset].getFrame(e.frameState, e.frame).tile : globals.map.globalTiles[e.tileGID];

        if (!tile) {
            console.warn("Entity missing frameSet or tileGID:", e);
            return false
        }

        if (e.x + tile.tileW < this.viewportX ||
            e.y + tile.tileH < this.viewportY) {
            return false
        }
        const xOffset = (globals.state.state.entities.player.x - (RES_W / 2));
        const yOffset = (globals.state.state.entities.player.y - (RES_H / 2));

        const ctx = this.elContext;
        /** <-- copied from source **/

        tile.collisions.forEach(c => {
            ctx.strokeStyle = ctx.fillStyle = 'black';
            ctx.strokeRect(e.x - xOffset + c.x, e.y - yOffset + c.y, c.width, c.height);
        });

        ctx.strokeStyle = ctx.fillStyle = 'red';
        ctx.font = '16px monospace';
        ctx.textBaseline = 'bottom';
        ctx.fillText(e.id, e.x - xOffset, e.y - yOffset + tile.tileH);

        ctx.textBaseline = 'top';
        ctx.fillText(e.type, e.x - xOffset, e.y - yOffset);

        ctx.strokeRect(e.x - xOffset, e.y - yOffset, tile.tileW, tile.tileH);
        return ret;
    }

    drawTiles(c, layer) {
        const ret = super.drawTiles(c, layer);
        if (layer.name != "fg0") return ret;

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
