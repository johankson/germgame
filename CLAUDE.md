# GERM GAME

- See README.md for initial information

## General

- Write straight forward code (at least in the first iterations)
- Ask clarifying questions if needed
- Think a bit extra on major decisions that will impact the development for a long time, like frameworks.
- It's a game, gameplay and graphics matter most
- It's proof of concept, not production code

## Stack

- **Vite** — dev server and bundler (`npm run dev` to start)
- **TypeScript** — strict mode, ES2020 target
- **PixiJS v8** — WebGL rendering, `app.ticker` drives the render loop
- **Matter.js** — 2D physics engine for soft-body simulation

## Architecture

- `src/main.ts` — PixiJS app init, mounts canvas, calls createGame
- `src/game.ts` — Matter.js engine + runner, game loop via app.ticker
- `src/cell.ts` — Cell class: 100-vertex ring soft body + PixiJS polygon drawing
- `src/input.ts` — Arrow key state tracker

## Key design decisions

- Soft body = ring of 100 small Matter.js circle bodies connected by spring constraints
- Edge constraints (stiffness 0.15) maintain perimeter shape
- Cross constraints i↔i+50 (stiffness 0.05) prevent pancake collapse
- Movement = force applied to leading-edge vertices (dot product > 0 with direction)
- Zero gravity environment simulates liquid