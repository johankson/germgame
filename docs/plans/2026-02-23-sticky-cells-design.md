# Sticky Cell Adhesion Design

**Date:** 2026-02-23
**Status:** Approved

---

## Overview

Replace the current Connector spring-network with a contact-based adhesion system. Cells become sticky when the player toggles sticky mode (`F`). Touching cells form a bond that persists. The bond is visualised as a short, fat organic neck bridge at the membrane junction — not a long rectangular span.

---

## Section 1: Interaction Model

**Toggle key:** `F` — enters/exits sticky mode globally.

**Bond formation:**
- While sticky mode is active, any two cells whose centres come within `2 × RING_RADIUS + 20 px` (~220 px) automatically bond.
- The bond persists after sticky mode is turned off.
- Cell division **always** bonds parent ↔ daughter regardless of sticky mode (they start overlapping and would bond instantly anyway).

**HUD indicator:** a small lit `[F] FUSE` label in the scoreboard panel while sticky mode is on.

**Cancellation:** no mechanic to break bonds (out of scope for this iteration).

---

## Section 2: Physics

The Connector's entire internal spring network is deleted (positions, velocities, springs arrays — ~150 lines).

Two forces in `game.ts` replace it:

| Force | Condition | Effect |
|---|---|---|
| Repulsion (existing) | centres < 200 px | push apart |
| Adhesion (existing `LINK_K`) | centres > 220 px | pull together |

These balance at ~210 px centre-to-centre — cells rest just touching.

**Bond creation loop** (runs each frame while sticky mode is on):
```
for each pair (a, b) of cells:
  if dist(a, b) < 220 and (a, b) not already bonded:
    bonds.push({ a, b })
```

The `connectors` array is renamed `bonds`. The `pendingConnectors` deferral mechanism is removed — bonds form immediately on contact.

---

## Section 3: Visual Neck Bridge

`Connector` class is stripped to a pure visual renderer. Each frame `draw(cell1, cell2)` computes:

```
axis     = normalise(cell2.center − cell1.center)
perp     = axis rotated 90°
contact1 = cell1.center + axis × RING_RADIUS
contact2 = cell2.center − axis × RING_RADIUS
halfW    = 30 px  (bridge half-width)

points = [
  contact1 + perp × halfW,
  contact1 − perp × halfW,
  contact2 − perp × halfW,
  contact2 + perp × halfW,
]
```

Drawn with `roundedPoly(points, 14)` — large corner radius gives the pill/pore shape.

- **Colour:** same warm amber as current connector (`0xc47820` fill, `0xf0b050` stroke)
- **At rest gap (~10 px):** bridge is ~10 px long × 60 px wide — squat organic pore
- **Fade:** alpha scales down as gap grows beyond 30 px, so stretched bonds look weaker

---

## Out of Scope

- Bond breaking mechanic
- Visual indication of bond strength
- More than one bond between the same pair of cells
