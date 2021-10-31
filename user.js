// ==UserScript==
// @name         Hackceler8 Game Tools
// @namespace    http://localhost:4567/
// @version      1.0
// @description  try to take over the world!
// @author       Tea Deliverers
// @match        http://localhost:4567/
// @grant        none
// @run-at       document-body
// ==/UserScript==

'use strict';

const mitmAddr = "ws://localhost:12450";

class ProxyWS extends WebSocket {
    constructor(addr) {
        super(mitmAddr);
    }
};

WebSocket = ProxyWS;

class ProxyVisuals extends visuals.Visuals {
    renderEntity(e) {
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
        const xOffset = (globals.state.state.entities.player.x - (RES_W/2));
        const yOffset = (globals.state.state.entities.player.y - (RES_H/2));

        const ctx = this.elContext;
        /** <-- copied from source **/

        ctx.strokeStyle = 'red';
        ctx.strokeRect((e.x - xOffset)|0, (e.y - yOffset)|0, tile.tileW, tile.tileH);
        this.playerCanvasClearRects.push([(e.x - xOffset - 1)|0, (e.y - yOffset - 1)|0, tile.tileW + 2, tile.tileH + 2]);

        return super.renderEntity(e);
    }
}

visuals.Visuals = ProxyVisuals;
