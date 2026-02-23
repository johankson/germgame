# Cell Division Design

**Date:** 2026-02-23
**Status:** Approved

---

## Overview

Player-triggered cell division with a hold-to-preview interaction. The hovered cell splits into two halves that regrow to full size. Organelles are distributed positionally based on which side of the split axis they fall on.

---

## Section 1: Interaction Model

**Trigger key:** `Space`

**Flow:**
1. Player hovers mouse over a cell (existing hover highlight activates)
2. Player **holds Space** — a glowing split preview line appears across the cell, perpendicular to the vector from cell center → mouse cursor. The line updates in real time as the mouse moves.
3. Player **releases Space** — division executes
4. Moving the mouse off the cell or pressing `Escape` while holding cancels the preview with no effect

**Constraints:**
- No energy requirement — division is always available (can be gated on energy in a future step)
- Any cell can be divided (hover selects it)

---

## Section 2: Visual Feedback

**Preview state (Space held over a cell):**
- A dashed line crosses the full cell diameter along the split axis, drawn as small bright rectangles (~4×2 px), color `0xccffee`, pulsing alpha
- The two membrane halves tint differently — one side amber, the other blue — showing what each daughter will become
- Organelles on the "new cell" side dim slightly and shift color to signal they will migrate

**Split animation (~30 frames on release):**
- Cell briefly **pinches** at the split line — vertices near the centre pull inward for ~10 frames
- Two new cells **pop apart** from the pinch point, each starting at ~50% of full radius
- Each daughter **inflates** back to full size naturally via existing radial spring physics (no extra code — `restRadii` stays at `RING_RADIUS`, springs do the work)
- Brief white flash at the split point on the frame of separation

**New cell motion:**
- Gets a small velocity impulse directly away from the original so it drifts apart

---

## Section 3: Game Mechanics

### Cluster topology

| Half | Connector | Behaviour |
|---|---|---|
| Original | Keeps existing connector to cell2 | Stays in cluster |
| New | None | Floats free, drifts away |

### Organelle assignment (positional)

- The split axis divides the cell plane into two sides
- Each organelle (receptor, furnace, factory) independently checks which side of the axis its current world position falls on
- Goes to whichever daughter cell occupies that side
- **Tie-break:** organelles exactly on the split line go to the original half

### Daughter cell capabilities

| Has receptor | Has furnace | Can do |
|---|---|---|
| ✓ | ✓ | Full energy cycle (attract → ingest → convert) |
| ✓ | ✗ | Can attract and ingest nutrients; no conversion |
| ✗ | ✓ | Can convert already-ingested nutrients; no attraction |
| ✗ | ✗ | Inert — no energy system |

### Out of scope (this feature)

- No new connector between the two daughters
- No cap on number of divisions
- No organelle regrowth on a bare daughter cell

---

## Open Questions (for implementation)

- What key triggers the preview cancel (`Escape`, mouse-off, or both)?
- Should cell2 be divisible even though it currently has no organelles?
- How many cells should the game support before performance is a concern?
