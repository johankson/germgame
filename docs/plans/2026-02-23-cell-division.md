# Cell Division Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the player hold Space over a hovered cell to preview a split axis, then release to divide the cell into two daughters that grow back to full size, with organelles distributed positionally.

**Architecture:** Space-hold triggers a real-time split-line preview drawn in world space; on release a new Cell is created at ~50% radius and inflates naturally via existing spring physics. Organelle ownership is tracked as mutable variables in game.ts; the Receptor is destroyed and recreated when it transfers to a new cell.

**Tech Stack:** PixiJS v8 (Graphics for preview/flash), TypeScript, custom verlet physics in Cell.

**Design doc:** `docs/plans/2026-02-23-cell-division-design.md`

---

### Task 1: Track Space key in Input

**Files:**
- Modify: `src/input.ts`

The current `Input` class only tracks arrow keys via a named struct. Add Space hold and a one-shot "just released" flag.

**Step 1: Edit `src/input.ts`**

Replace the entire file with:

```typescript
export class Input {
  readonly keys = { up: false, down: false, left: false, right: false, space: false }
  private spaceJustReleased = false

  constructor() {
    window.addEventListener('keydown', e => this.setKey(e.key, true))
    window.addEventListener('keyup',  e => this.setKey(e.key, false))
  }

  direction(): { x: number; y: number } {
    let x = 0
    let y = 0
    if (this.keys.left)  x -= 1
    if (this.keys.right) x += 1
    if (this.keys.up)    y -= 1
    if (this.keys.down)  y += 1

    if (x !== 0 && y !== 0) {
      const len = Math.sqrt(x * x + y * y)
      x /= len
      y /= len
    }

    return { x, y }
  }

  isSpaceHeld(): boolean { return this.keys.space }

  /** Returns true exactly once per Space keyup event. Consumes the flag. */
  wasSpaceReleased(): boolean {
    const r = this.spaceJustReleased
    this.spaceJustReleased = false
    return r
  }

  private setKey(key: string, val: boolean) {
    switch (key) {
      case 'ArrowUp':    this.keys.up    = val; break
      case 'ArrowDown':  this.keys.down  = val; break
      case 'ArrowLeft':  this.keys.left  = val; break
      case 'ArrowRight': this.keys.right = val; break
      case ' ':
        this.keys.space = val
        if (!val) this.spaceJustReleased = true
        break
    }
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/input.ts
git commit -m "feat: track Space key hold and release in Input"
```

---

### Task 2: Add `isHovered()` and `initialRadius` to Cell

**Files:**
- Modify: `src/cell.ts`

Two small additions:
- `isHovered()` getter so game.ts can find the hovered cell
- `initialRadius` constructor parameter so daughter cells can start compressed

**Step 1: Add `isHovered()` getter**

After `getVertexCount()` (line 67), add:

```typescript
isHovered(): boolean { return this.hovered }
```

**Step 2: Add `initialRadius` parameter to constructor**

Change the constructor signature from:
```typescript
constructor(stage: PIXI.Container, cx: number, cy: number, vertexCount = 32) {
```
to:
```typescript
constructor(stage: PIXI.Container, cx: number, cy: number, vertexCount = 32, initialRadius = RING_RADIUS) {
```

Then in the vertex placement loop, change `RING_RADIUS` to `initialRadius`:
```typescript
// Before:
this.positions.push({
  x: cx + Math.cos(angle) * RING_RADIUS,
  y: cy + Math.sin(angle) * RING_RADIUS,
})

// After:
this.positions.push({
  x: cx + Math.cos(angle) * initialRadius,
  y: cy + Math.sin(angle) * initialRadius,
})
```

The `restRadii` array still uses `RING_RADIUS` — this is intentional. The spring forces will push a compressed daughter cell back out to full size automatically.

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/cell.ts
git commit -m "feat: add isHovered() getter and initialRadius constructor param to Cell"
```

---

### Task 3: Add `getVertexPosition()` and `destroy()` to Receptor

**Files:**
- Modify: `src/receptor.ts`

When a receptor transfers to a new daughter cell, we need to (a) find out where the receptor currently sits (to determine which side of the split axis it's on) and (b) clean up the old PixiJS Graphics object before creating a new Receptor on the new cell.

**Step 1: Add `getVertexPosition()` method**

After the constructor (after line 31), add:

```typescript
/** Returns the world position of the receptor's membrane vertex on the given cell. */
getVertexPosition(cell: Cell): { x: number; y: number } {
  return cell.getSmoothedVertexPosition(this.vertexIdx)
}
```

**Step 2: Add `destroy()` method**

At the end of the class (before the closing `}`), add:

```typescript
destroy(): void {
  this.graphics.destroy()
}
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/receptor.ts
git commit -m "feat: add getVertexPosition() and destroy() to Receptor"
```

---

### Task 4: Mouse tracking and organelle ownership in game.ts

**Files:**
- Modify: `src/game.ts`

This task wires up mouse position and converts organelle update calls to use mutable owner-cell variables, which Task 6 will reassign during division.

**Step 1: Add mouse tracking**

After `const input = new Input()`, add:

```typescript
// Screen-space mouse position — updated on mousemove
const mouse = { screenX: 0, screenY: 0 }
app.canvas.addEventListener('mousemove', (e: MouseEvent) => {
  const rect = (app.canvas as HTMLCanvasElement).getBoundingClientRect()
  mouse.screenX = e.clientX - rect.left
  mouse.screenY = e.clientY - rect.top
})
```

**Step 2: Add organelle-owner variables and cells array**

After the mouse block, add:

```typescript
// Tracks all live cells for update/draw
const cells: Cell[] = [cell1, cell2]

// Which cell each organelle currently belongs to
let furnaceOwner = cell1
let receptorOwner = cell1
// factoryOwner is omitted — factory is cosmetic, always anchored to cell1 area
```

**Step 3: Change `receptor` to `let`**

The receptor will be destroyed and recreated when it transfers. Change:
```typescript
const receptor = new Receptor(worldContainer, cell1)
```
to:
```typescript
let receptor = new Receptor(worldContainer, cell1)
```

**Step 4: Replace hardcoded cell1 in the organelle update calls inside the ticker**

Replace:
```typescript
const cellCenter  = cell1.getCenter()
const attachPoint = connector.getCell1AttachPoint(cell1)

furnace.update({ x: cellCenter.x, y: cellCenter.y - 20 }, cell1, nutrientPool)
squareFactory.update({ x: cellCenter.x, y: cellCenter.y + 20 }, attachPoint)
receptor.update(cell1, nutrientPool)
```

With:
```typescript
const furnaceCenter  = furnaceOwner.getCenter()
const attachPoint    = connector.getCell1AttachPoint(cell1)  // stays on cell1 (cosmetic)

furnace.update({ x: furnaceCenter.x, y: furnaceCenter.y - 20 }, furnaceOwner, nutrientPool)
squareFactory.update({ x: furnaceCenter.x, y: furnaceCenter.y + 20 }, attachPoint)
receptor.update(receptorOwner, nutrientPool)
```

**Step 5: Replace `cell1.update(); cell2.update()` with a cells-array loop**

Replace:
```typescript
connector.update(cell1, cell2)
cell1.update()
cell2.update()
```

With:
```typescript
connector.update(cell1, cell2)
for (const cell of cells) cell.update()
```

**Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 7: Run dev server and visually confirm nothing changed**

```bash
npm run dev
```

Open browser. Game should look and behave identically to before. Cells move, nutrients work, energy arc fills.

**Step 8: Commit**

```bash
git add src/game.ts
git commit -m "refactor: organelle ownership vars and cells array for division support"
```

---

### Task 5: Division preview rendering

**Files:**
- Modify: `src/game.ts`

Draw a pulsing dotted line across the hovered cell while Space is held, perpendicular to the mouse-to-cell-center direction.

**Step 1: Add division state and preview graphics**

After the `cells` / owner vars block, add:

```typescript
// Division preview state
let divisionTarget: Cell | null = null

const divisionGraphics = new PIXI.Graphics()
worldContainer.addChild(divisionGraphics)
```

**Step 2: Add the preview helper function**

Add this function just before the `app.ticker.add(...)` call:

```typescript
function drawSplitPreview(g: PIXI.Graphics, cell: Cell, mouseWorld: { x: number; y: number }): void {
  const center = cell.getCenter()
  const dx = mouseWorld.x - center.x
  const dy = mouseWorld.y - center.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  // Split axis is perpendicular to the mouse direction
  const ax = -dy / len
  const ay =  dx / len

  // Pulsing dotted line — small squares at intervals along the axis
  const alpha = 0.65 + Math.sin(Date.now() / 150) * 0.25
  g.setFillStyle({ color: 0xccffee, alpha })
  const DASH = 5, GAP = 5
  for (let d = -120; d <= 120; d += DASH + GAP) {
    g.rect(center.x + ax * d - 2, center.y + ay * d - 2, 4, 4)
  }
  g.fill()
}
```

**Step 3: Insert division preview logic into the ticker**

Inside `app.ticker.add(...)`, after `nutrientPool.update(cell1)` and before the `hud.update(...)` call, add:

```typescript
// Mouse in world space
const mouseWorld = {
  x: mouse.screenX - worldContainer.x,
  y: mouse.screenY - worldContainer.y,
}

// Division preview
const spaceReleased = input.wasSpaceReleased()
divisionGraphics.clear()

if (input.isSpaceHeld()) {
  const hoveredCell = cells.find(c => c.isHovered()) ?? null
  if (hoveredCell) {
    divisionTarget = hoveredCell
    drawSplitPreview(divisionGraphics, hoveredCell, mouseWorld)
  } else {
    divisionTarget = null  // cancelled — mouse moved off cell
  }
} else {
  if (spaceReleased && divisionTarget) {
    // executeDiv will be added in Task 6
  }
  divisionTarget = null
}
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 5: Visual test — preview line**

```bash
npm run dev
```

Hover mouse over a cell, hold Space. A pulsing dotted line should appear across the cell, rotating as you move the mouse. Release or move mouse off cell — line disappears.

**Step 6: Commit**

```bash
git add src/game.ts
git commit -m "feat: division preview — pulsing split line on Space hold"
```

---

### Task 6: Execute division

**Files:**
- Modify: `src/game.ts`

On Space release with a valid target: compute split axis, create a compressed daughter cell that inflates naturally, reassign organelles to whichever side they fall on.

**Step 1: Add the `executeDiv` helper function**

Add this function right after `drawSplitPreview` (before `app.ticker.add`):

```typescript
function executeDiv(cell: Cell, mouseWorld: { x: number; y: number }): void {
  const center = cell.getCenter()
  const dx = mouseWorld.x - center.x
  const dy = mouseWorld.y - center.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const mdx = dx / len   // unit vector pointing toward mouse (new-cell side)
  const mdy = dy / len

  // Helper: is a world-space point on the "new cell" (mouse) side of the split?
  const onNewSide = (px: number, py: number) =>
    (px - center.x) * mdx + (py - center.y) * mdy > 0

  // Determine which organelles transfer to the new cell.
  // Furnace and factory positions are the offsets used in the ticker.
  const furnacePos  = { x: center.x, y: center.y - 20 }
  const factoryPos  = { x: center.x, y: center.y + 20 }
  const receptorPos = receptor.getVertexPosition(receptorOwner)

  const furnaceTransfers  = furnaceOwner === cell  && onNewSide(furnacePos.x,  furnacePos.y)
  const receptorTransfers = receptorOwner === cell && onNewSide(receptorPos.x, receptorPos.y)
  // factory is cosmetic — skip transfer for now

  // Spawn daughter at same centre, 50% radius, slightly offset toward mouse so
  // the spring physics will push the two cells apart naturally.
  const OFFSET = 18   // px nudge toward mouse side
  const newCell = new Cell(
    worldContainer,
    center.x + mdx * OFFSET,
    center.y + mdy * OFFSET,
    vertexCount,
    RING_RADIUS * 0.5,
  )
  cells.push(newCell)

  // Small outward velocity impulse so the daughter drifts away
  const IMPULSE = 2.0
  for (let i = 0; i < vertexCount; i++) {
    newCell.applyExternalForce(i, mdx * IMPULSE, mdy * IMPULSE)
  }

  // Reassign organelles
  if (furnaceTransfers)  furnaceOwner  = newCell
  if (receptorTransfers) {
    receptor.destroy()
    receptor     = new Receptor(worldContainer, newCell)
    receptorOwner = newCell
  }

  // Brief split flash stored for rendering (Task 7 adds the draw call)
  flashFrames = 20
  flashAxis   = { cx: center.x, cy: center.y, ax: -mdy / 1, ay: mdx / 1 }  // unit axis already normalised above; reuse mdx/mdy rotated
  // Correct: axis perpendicular to mouse dir is (-mdy, mdx) — already normalised since |mouseDir|=1
}
```

Wait — there's an error in the flash axis above. Fix `flashAxis` to use the actual perpendicular:
```typescript
  flashAxis = { cx: center.x, cy: center.y, ax: -mdy, ay: mdx }
```

**Step 2: Add flash state variables**

Add these next to `divisionTarget`:

```typescript
let flashFrames = 0
let flashAxis: { cx: number; cy: number; ax: number; ay: number } | null = null
```

**Step 3: Wire `executeDiv` into the ticker**

Replace the placeholder comment in Task 5:
```typescript
    // executeDiv will be added in Task 6
```
With:
```typescript
    executeDiv(divisionTarget, mouseWorld)
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 5: Visual test — division executes**

```bash
npm run dev
```

- Hover over a cell, hold Space, position the split line, release.
- A second cell should appear and inflate from small to full size.
- Try splitting so the receptor ends up on the new cell — nutrient attraction should follow it.
- Try splitting so the furnace ends up on the new cell — energy conversion should follow it.

**Step 6: Commit**

```bash
git add src/game.ts
git commit -m "feat: execute cell division — daughter cell with positional organelle transfer"
```

---

### Task 7: Split flash animation

**Files:**
- Modify: `src/game.ts`

A brief bright line at the split point for ~20 frames to punctuate the moment of division.

**Step 1: Add flash draw call**

Inside the ticker, right after `divisionGraphics.clear()` (before the `if (input.isSpaceHeld())` block), add:

```typescript
// Split flash
if (flashFrames > 0 && flashAxis) {
  const t = flashFrames / 20   // 1 → 0 as it fades
  divisionGraphics.setStrokeStyle({ width: 2 + t * 2, color: 0xffffff, alpha: t * 0.9 })
  divisionGraphics.moveTo(flashAxis.cx + flashAxis.ax * -120, flashAxis.cy + flashAxis.ay * -120)
  divisionGraphics.lineTo(flashAxis.cx + flashAxis.ax *  120, flashAxis.cy + flashAxis.ay *  120)
  divisionGraphics.stroke()
  flashFrames--
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 3: Visual test — flash appears**

```bash
npm run dev
```

Divide a cell. A bright white line should flash at the split point and fade out over ~0.3 seconds.

**Step 4: Commit**

```bash
git add src/game.ts
git commit -m "feat: split flash animation on cell division"
```

---

## Known Limitations (acceptable for POC)

- `nutrientPool.update(cell1)` still only bounces nutrients off cell1 — daughter cells don't have membrane collision for nutrients yet
- The connector always links cell1↔cell2 — new daughters float free with no connector
- The factory (ribosome) always animates toward the cell1 connector attachment regardless of which cell it logically belongs to
- No cap on number of divisions
