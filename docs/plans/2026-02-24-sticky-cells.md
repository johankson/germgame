# Sticky Cell Adhesion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Connector spring-network with contact-based adhesion: `F` toggles sticky mode, touching cells bond and show a short fat neck bridge at the membrane junction.

**Architecture:** Connector loses all spring physics (~200 lines deleted) and becomes a 60-line pure visual renderer. A `bonds` array in game.ts replaces `connectors` and `pendingConnectors`. Physics adhesion reuses the existing LINK_K spring. Sticky mode is a toggle in Input; its state flows to the HUD.

**Tech Stack:** TypeScript, PixiJS v8, `npx tsc --noEmit` to verify.

---

### Task 1: F-key fuse-mode toggle in `input.ts`

**Files:**
- Modify: `src/input.ts`

**Step 1: Add `fuseMode` field and getter**

Inside the class body (after `private spaceJustReleased`):

```typescript
private fuseMode = false

isFuseMode(): boolean { return this.fuseMode }
```

**Step 2: Handle `f`/`F` in `setKey`**

Add this case to the switch (toggle only on keydown, i.e. `val === true`):

```typescript
case 'f':
case 'F':
  if (val) this.fuseMode = !this.fuseMode
  break
```

**Step 3: Verify**
```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 4: Commit**
```bash
git add src/input.ts
git commit -m "feat: F key toggles fuse mode in Input"
```

---

### Task 2: Rewrite `connector.ts` as a pure visual neck bridge

**Files:**
- Modify: `src/connector.ts` (full replacement)

**Context:** Everything except `roundedPoly` is deleted. The new class:
- Constructor: takes only `stage` (no cell args, no spring setup)
- `update(cell1, cell2)`: calls `draw()` only
- `destroy()`: cleans up the Graphics object
- `draw()`: computes a 4-point pill shape between the two surface contact points

`RING_RADIUS = 100` is hardcoded — it must match the constant in `cell.ts`.

**Step 1: Replace the entire file**

```typescript
import * as PIXI from 'pixi.js'
import { Cell } from './cell'

// Must stay in sync with RING_RADIUS in cell.ts
const RING_RADIUS = 100
// Half the bridge width perpendicular to the connector axis
const HALF_WIDTH  = 30
// Surface-to-surface gap beyond which the bridge fully fades out
const MAX_GAP     = 40

export class Connector {
  private readonly graphics: PIXI.Graphics
  private hovered = false

  constructor(stage: PIXI.Container) {
    this.graphics = new PIXI.Graphics()
    stage.addChild(this.graphics)
    this.graphics.eventMode = 'static'
    this.graphics.on('pointerenter', () => { this.hovered = true })
    this.graphics.on('pointerleave', () => { this.hovered = false })
  }

  update(cell1: Cell, cell2: Cell) {
    this.draw(cell1, cell2)
  }

  destroy() {
    this.graphics.destroy()
  }

  private draw(cell1: Cell, cell2: Cell) {
    const g = this.graphics
    g.clear()

    const c1   = cell1.getCenter()
    const c2   = cell2.getCenter()
    const dx   = c2.x - c1.x
    const dy   = c2.y - c1.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1

    // Don't draw when cells are too far apart to be touching
    const surfaceGap = dist - 2 * RING_RADIUS
    if (surfaceGap > MAX_GAP) return

    const ax = dx / dist   // unit axis cell1 → cell2
    const ay = dy / dist
    const px = -ay         // perpendicular (90° CCW rotation)
    const py =  ax

    // Points on each cell's surface facing the other cell
    const t1x = c1.x + ax * RING_RADIUS,  t1y = c1.y + ay * RING_RADIUS
    const t2x = c2.x - ax * RING_RADIUS,  t2y = c2.y - ay * RING_RADIUS

    const hw = HALF_WIDTH
    const points = [
      t1x + px * hw, t1y + py * hw,
      t1x - px * hw, t1y - py * hw,
      t2x - px * hw, t2y - py * hw,
      t2x + px * hw, t2y + py * hw,
    ]

    // Alpha fades as cells drift apart; hovered always fully opaque
    const alpha  = this.hovered
      ? 0.92
      : 0.72 * (1 - Math.max(0, surfaceGap) / MAX_GAP)
    const fill   = this.hovered ? 0xe8a050 : 0xc47820
    const stroke = this.hovered ? 0xffffff : 0xf0b050

    const midX = (c1.x + c2.x) / 2
    const midY = (c1.y + c2.y) / 2
    this.graphics.hitArea = new PIXI.Circle(midX, midY, hw + 10)

    g.setStrokeStyle({ width: this.hovered ? 3 : 2, color: stroke })
    g.setFillStyle({ color: fill, alpha })
    roundedPoly(g, points, 14)
    g.fill()
    g.stroke()
  }
}

// Draws a closed polygon with rounded corners.
function roundedPoly(g: PIXI.Graphics, pts: number[], radius: number) {
  const n = pts.length / 2
  for (let i = 0; i < n; i++) {
    const pi = i * 2
    const pp = (((i - 1) % n) + n) % n * 2
    const pn = ((i + 1) % n) * 2

    const cx = pts[pi],  cy = pts[pi + 1]
    const px = pts[pp],  py = pts[pp + 1]
    const nx = pts[pn],  ny = pts[pn + 1]

    const d1x = cx - px,  d1y = cy - py
    const d2x = nx - cx,  d2y = ny - cy
    const len1 = Math.sqrt(d1x * d1x + d1y * d1y) || 1
    const len2 = Math.sqrt(d2x * d2x + d2y * d2y) || 1
    const r = Math.min(radius, len1 / 2, len2 / 2)

    const a1x = cx - (d1x / len1) * r,  a1y = cy - (d1y / len1) * r
    const a2x = cx + (d2x / len2) * r,  a2y = cy + (d2y / len2) * r

    if (i === 0) g.moveTo(a1x, a1y)
    else         g.lineTo(a1x, a1y)
    g.quadraticCurveTo(cx, cy, a2x, a2y)
  }
  g.closePath()
}
```

**Step 2: Verify (will fail on game.ts — that's expected)**
```bash
npx tsc --noEmit
```
Expected: errors about old Connector API in `game.ts`. Fine — fixed in Task 4.

**Step 3: Commit**
```bash
git add src/connector.ts
git commit -m "refactor: strip Connector to pure visual neck bridge, delete spring physics"
```

---

### Task 3: Add `fuseMode` to `GameStats` in `hud.ts`

**Files:**
- Modify: `src/hud.ts`

**Context:** `game.ts` will pass `fuseMode: boolean` in the stats object. The interface must be updated first so the compiler is satisfied when `game.ts` is changed in Task 4.

**Step 1: Add field to `GameStats`**

```typescript
export interface GameStats {
  elapsedFrames: number
  energy: number
  maxEnergy: number
  consumed: number
  fuseMode: boolean       // ← add this line
}
```

**Step 2: Add `modeText` PIXI.Text to the class**

Add a private field:
```typescript
private readonly modeText: PIXI.Text
```

In the constructor, after the last `statTexts` loop:
```typescript
this.modeText = new PIXI.Text({
  text: '',
  style: { fontFamily: FONT, fontSize: FONT_SZ, fill: '#55ffaa' },
})
stage.addChild(this.modeText)
```

**Step 3: Render the indicator at the end of `drawScoreboard`**

Append to the end of `drawScoreboard()`:
```typescript
if (stats.fuseMode) {
  const pulse = 0.7 + Math.sin(Date.now() / 200) * 0.3
  this.modeText.text  = '[F] FUSE'
  this.modeText.alpha = pulse
  // Right side of the header row
  this.modeText.x = PANEL_X + PANEL_W - PAD_X - 128
  this.modeText.y = PANEL_Y + PAD_Y
} else {
  this.modeText.text = ''
}
```

**Step 4: Verify (game.ts still has old stats call — temporary)**
```bash
npx tsc --noEmit
```
Expected: one error about missing `fuseMode` in `game.ts` call. Fine — fixed in Task 4.

**Step 5: Commit**
```bash
git add src/hud.ts
git commit -m "feat: add fuseMode field to GameStats and [F] FUSE HUD indicator"
```

---

### Task 4: Rewrite `game.ts` — replace connector system with bonds

**Files:**
- Modify: `src/game.ts`

**Context:** Current state after Tasks 1–3:
- `connector` / `connectors` / `pendingConnectors` still exist and reference the old Connector API
- `connector.getCell1AttachPoint(cell1)` is called for squareFactory
- `hud.update` is missing `fuseMode`
- The LINK_K loop iterates `connectors`

All of these must change. Read the current `src/game.ts` carefully before editing.

**Step 1: Replace connector/connectors/pendingConnectors setup (lines 36–39)**

Replace:
```typescript
const connector  = new Connector(worldContainer, cell1, cell2)
const connectors: Array<{ c: Connector; a: Cell; b: Cell }> = [{ c: connector, a: cell1, b: cell2 }]
// Connectors for newly divided cells are deferred until the daughter has separated.
const pendingConnectors: Array<{ a: Cell; b: Cell; framesLeft: number }> = []
```

With:
```typescript
const bonds: Array<{ c: Connector; a: Cell; b: Cell }> = []
// Add a bond between two cells unless one already exists for this pair.
function addBond(a: Cell, b: Cell) {
  if (bonds.some(bond => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a))) return
  bonds.push({ c: new Connector(worldContainer), a, b })
}
// cell1 and cell2 start bonded at game creation
addBond(cell1, cell2)
```

**Step 2: Replace LINK_K loop (iterates `connectors`)**

Replace:
```typescript
    for (const { a, b } of connectors) {
```
With:
```typescript
    for (const { a, b } of bonds) {
```

**Step 3: Remove `pendingConnectors` promotion loop and replace connectors draw loop**

Replace the block:
```typescript
    // Promote deferred connectors once the daughter has had time to separate.
    for (let i = pendingConnectors.length - 1; i >= 0; i--) {
      const p = pendingConnectors[i]
      if (--p.framesLeft <= 0) {
        connectors.push({ c: new Connector(worldContainer, p.a, p.b), a: p.a, b: p.b })
        pendingConnectors.splice(i, 1)
      }
    }

    // Connectors run first: inject attachment forces into cells before they integrate.
    for (const { c, a, b } of connectors) c.update(a, b)
```

With:
```typescript
    // Sticky mode: bond any pair of cells within touching range
    if (input.isFuseMode()) {
      for (let ci = 0; ci < cells.length; ci++) {
        for (let cj = ci + 1; cj < cells.length; cj++) {
          const ca = cells[ci].getCenter()
          const cb = cells[cj].getCenter()
          const dx = cb.x - ca.x, dy = cb.y - ca.y
          if (Math.sqrt(dx * dx + dy * dy) < 220) addBond(cells[ci], cells[cj])
        }
      }
    }

    // Draw bonds (purely visual — no physics forces from Connector)
    for (const { c, a, b } of bonds) c.update(a, b)
```

**Step 4: Fix squareFactory attachPoint**

Replace:
```typescript
    const attachPoint    = connector.getCell1AttachPoint(cell1)  // stays on cell1 (cosmetic)
```

With:
```typescript
    // Cosmetic attach point: cell1 surface facing cell2 (pure visual, no Connector dependency)
    const _bc1 = cell1.getCenter(), _bc2 = cell2.getCenter()
    const _bdx = _bc2.x - _bc1.x,  _bdy = _bc2.y - _bc1.y
    const _bdl = Math.sqrt(_bdx * _bdx + _bdy * _bdy) || 1
    const attachPoint = { x: _bc1.x + (_bdx / _bdl) * 100, y: _bc1.y + (_bdy / _bdl) * 100 }
```

**Step 5: Replace `pendingConnectors.push` in `executeDiv` with `addBond`**

Replace:
```typescript
    // Defer connector creation: daughter starts inside the parent at radius 50,
    // so vertex selection is wrong if we create it now. Wait 30 frames for separation.
    pendingConnectors.push({ a: cell, b: newCell, framesLeft: 30 })
```

With:
```typescript
    // Bond parent and daughter immediately — bridge is purely visual so no deferral needed
    addBond(cell, newCell)
```

**Step 6: Pass `fuseMode` to `hud.update`**

Replace the existing `hud.update(...)` call:
```typescript
    hud.update(clusterPos, cameraPos, app.screen.width, app.screen.height, {
      elapsedFrames,
      energy: cell1.energy,
      maxEnergy: cell1.maxEnergy,
      consumed: furnace.getConsumed(),
    })
```

With:
```typescript
    hud.update(clusterPos, cameraPos, app.screen.width, app.screen.height, {
      elapsedFrames,
      energy: cell1.energy,
      maxEnergy: cell1.maxEnergy,
      consumed: furnace.getConsumed(),
      fuseMode: input.isFuseMode(),
    })
```

**Step 7: Verify**
```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 8: Commit**
```bash
git add src/game.ts
git commit -m "feat: replace connector system with contact-based sticky cell bonds"
```
