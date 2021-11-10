# Hackceler8 Game Tools

## Controls
Recommending using arrow keys to move.

- Wheel scroll to zoom in/out
- <kbd>Shift</kbd> to move the map
- <kbd>V</kbd> to reset camera center to player
- <kbd>B</kbd> show `Entity`
- <kbd>H</kbd> enable simulation mode

  Under simulation mode:
  - `Tick` won't be recorded if the player is standing still
  - Point to destination, press <kbd>`</kbd> to teleport (path finding, may not succeed)
  - <kbd>Z</kbd> to undo ticks
  - <kbd>X</kbd> to redo ticks
  - <kbd>,</kbd> to decelerate
  - <kbd>.</kbd> to accelerate
  - <kbd>LeftCtrl</kbd> to temporarily accelerate
  - <kbd>T</kbd> to submit

  Press <kbd>H</kbd> again to sync with the server

## Display
Blue-yellow rectangle: Collision box

White line: Connects `Terminal` and `FlagConsole`

Magenta line: `Portal` pointing to its destination

Green line: Connects player and `Key`

Orange line: Connects `KeyReceptacle` and its controlling `Entity`

Red solid box: Death zone

## Dev Console

- `closeFloat()` to close all floating windows
- `searchTimeout` to set path searching timeout

## `Terminal` relay

Relays in-game `Terminal` to `localServer` (configured in `mitm.go`). Data is encoded in hex, with a newline character as end-of-line.

## Other

You may need to update related code in `hack.js` if the server/client-side code is changed. Directly copied code are commented with `copied from source`.

For example, update `playerTick` function if the corresponding `entities.Player.tick` is changed in the game code.

## Demo

[Tick Undo](https://imgur.com/a/7afbXqO)

[Path Finding](https://imgur.com/EunmgGJ)