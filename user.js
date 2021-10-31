// ==UserScript==
// @name         Hackceler8 Game Tools
// @namespace    http://localhost:4567/
// @version      1.0
// @description  try to take over the world!
// @author       Tea Deliverers
// @match        http://localhost:4567/
// @grant        none
// @run-at       document-start
// ==/UserScript==

'use strict';

const mitmAddr = "ws://localhost:12450";

const realWS = WebSocket.prototype;
WebSocket = function(addr) {
    return new realWS.constructor(mitmAddr);
}
WebSocket.prototype = realWS;

(function() {
})();