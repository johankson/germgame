# Connector Architecture: Design Approaches

This document records the three architecture approaches considered for Step 2 of the germ game: joining two cells with a soft-body connector.

## Feature summary

Two soft-body cells joined by a blue rectangular connector:
- Connector is a soft body (spring-connected vertices), not a rigid shape
- ~10 vertices per long side, each side attaching to the facing vertices of its cell
- Both cells respond physically to connector forces (Newton's 3rd law)
- Only cell 1 is keyboard-controlled; cell 2 is dragged along via connector physics
- Attachment spring rest length ≈ 0 — connector vertices start co-located with cell surface vertices

---

## Approach A: Force Injection Buffer *(chosen)*

### Concept

Minimal changes to `Cell`. Add a `pendingExternalForces[]` buffer and a small public API. The `Connector` calls this API before cells update each frame, injecting coupling forces that the cell consumes during its own integration step.

### Cell changes

Four public methods added, one new private field:

```typescript
// New field
private pendingExternalForces: Vec2[]   // zeroed after each step()

// New public methods
getVertexPosition(i: number): Vec2      // returns a copy of positions[i]
applyExternalForce(i: number, fx: number, fy: number): void  // accumulates into pendingExternalForces[i]
getCenter(): Vec2                       // promoted from private
getVertexCount(): number
```

Inside `step()`, pending forces are merged into the local force accumulator at the start, then zeroed:

```typescript
private step() {
  const forces = Array.from({ length: this.vertexCount }, () => ({ x: 0, y: 0 }))

  for (let i = 0; i < this.vertexCount; i++) {
    forces[i].x += this.pendingExternalForces[i].x
    forces[i].y += this.pendingExternalForces[i].y
    this.pendingExternalForces[i].x = 0
    this.pendingExternalForces[i].y = 0
  }

  // ... existing edge springs, radial springs, integration, crossing correction
}
```

### Connector structure

- Owns `positions[]` and `velocities[]` for its ~20 vertices (two columns of 10)
- Internal springs: vertical edge springs along each column, horizontal strut springs between columns, diagonal cross-braces for shear resistance
- Attachment springs: connector left column ↔ cell1 interface vertices, right column ↔ cell2 interface vertices

Interface vertex selection: find the N vertices with the highest dot product against the facing direction, sorted top-to-bottom by y position.

### Update order (per tick)

```
1. connector.update()
   - Read cell positions via getVertexPosition()
   - Compute attachment spring forces
   - Call cell1.applyExternalForce() and cell2.applyExternalForce() (Newton's 3rd law)
   - Integrate connector vertices
   - Draw

2. cell1.update()
   - step() merges pendingExternalForces, runs edge/radial springs, integrates
   - draw()

3. cell2.update()  (same as cell1)
```

### Trade-offs

| | |
|---|---|
| Cell refactor scope | Small — 4 methods, 1 field |
| New files | `src/connector.ts` |
| Force lag | 1 frame (imperceptible at 60fps) |
| Encapsulation | Cell exposes index-based write API |
| Extensibility | Add more `applyExternalForce` callers as needed |
| Debugging | Log `pendingExternalForces` before zeroing |

**Chosen because:** fewest changes, explicit data flow, the 1-frame lag is irrelevant for a proof of concept.

---

## Approach B: Force Contributor Callbacks

### Concept

Cell exposes a `registerForceContributor(fn)` method. The Connector registers lambdas on both cells at construction. These lambdas fire *inside* the cell's `step()`, receiving live access to the `positions[]` and `forces[]` arrays. Cell response to connector forces is zero-lag.

### Cell changes

```typescript
type ForceContributor = (positions: readonly Vec2[], forces: Vec2[]) => void

export class Cell {
  private forceContributors: ForceContributor[] = []

  registerForceContributor(fn: ForceContributor): void {
    this.forceContributors.push(fn)
  }

  getCenter(): Vec2 { ... }        // promoted to public
  getVertexCount(): number
}
```

Inside `step()`, after computing edge/radial springs, before integration:

```typescript
for (const fn of this.forceContributors) {
  fn(this.positions, forces)
}
```

### Connector structure

Same vertex layout as Approach A. At construction, registers two callbacks (one per cell). Each callback computes attachment spring forces using current cell vertex positions and writes directly into the cell's local `forces[]` array. The equal-and-opposite force is stored in a `pendingFromCellN[]` buffer, consumed by `connector.update()` on the next frame.

### Update order (per tick)

```
1. connector.update()
   - Consume pendingFromCell1[] and pendingFromCell2[]
   - Integrate connector vertices

2. cell1.update()
   - step() runs edge/radial springs, then calls forceContributors[0](positions, forces)
     -> Connector lambda writes attachment forces into cell1's forces[] directly
     -> Stores reversed forces in connector.pendingFromCell1[]
   - Integrate, draw

3. cell2.update()  (same)
```

### Trade-offs

| | |
|---|---|
| Cell refactor scope | Small — 1 method, 1 field |
| New files | `src/connector.ts` |
| Force lag | 0 lag for cell response; 1 frame for connector response |
| Encapsulation | Cell gives up live array references (read + write) to callbacks |
| Extensibility | N contributors with no extra plumbing — just register more |
| Debugging | Slightly harder — forces applied from callback registered elsewhere |

**Best choice if:** multiple force contributors are expected (environmental effects, repulsion between cells, etc.).

---

## Approach C: Unified Physics World

### Concept

Extract all spring physics into a `PhysicsWorld` class that owns a flat pool of all vertices from all entities. Cell and Connector become layout descriptors and renderers — they allocate vertex ranges and register springs into the world. The world steps everything in one pass; no cross-entity force injection is needed at all.

### New class: PhysicsWorld (`src/physics.ts`)

```typescript
export class PhysicsWorld {
  positions: Vec2[]
  velocities: Vec2[]
  private springs: Spring[]
  private pendingImpulses: Vec2[]

  allocateVertices(count: number, cx: number, cy: number, layout: 'ring' | 'grid'): number
  addSpring(a: number, b: number, restLen: number, stiffness: number): void
  applyImpulse(index: number, fx: number, fy: number): void
  getPosition(index: number): Vec2
  getCenterOf(offset: number, count: number): Vec2
  registerCrossingRange(offset: number, count: number): void  // for per-cell crossing correction

  step(): void   // single pass: all springs + all impulses + all vertices
}
```

### Cell changes

Cell loses its physics arrays and delegates entirely to the world:

```typescript
export class Cell {
  readonly vertexOffset: number
  readonly vertexCount: number
  private world: PhysicsWorld

  constructor(stage, world: PhysicsWorld, cx, cy, vertexCount = 32) {
    this.vertexOffset = world.allocateVertices(vertexCount, cx, cy, 'ring')
    this.registerSprings(world)    // edge springs + radial springs into world
    world.registerCrossingRange(this.vertexOffset, vertexCount)
  }

  applyMovement(dir) {
    // read from world.getPosition(), write via world.applyImpulse()
  }

  update() {
    this.draw()   // world.step() already ran — just read positions and draw
  }
}
```

### Connector structure

Connector becomes a thin shell:

```typescript
export class Connector {
  constructor(stage, world: PhysicsWorld, cell1: Cell, cell2: Cell) {
    const offset = world.allocateVertices(20, ...)   // two columns of 10
    // Register internal springs (vertical edges, struts, cross-braces)
    // Register attachment springs — they're just regular springs between different vertex ranges
    for (let i = 0; i < 10; i++) {
      world.addSpring(offset + i, cell1InterfaceIndices[i], 0, ATTACH_STIFFNESS)
      world.addSpring(offset + 10 + i, cell2InterfaceIndices[i], 0, ATTACH_STIFFNESS)
    }
  }
}
```

### Update order (per tick)

```
1. world.step()       - single pass: all springs across all entities simultaneously
2. cell1.update()     - draw() only
3. cell2.update()     - draw() only
4. connector.update() - draw() only
```

### Trade-offs

| | |
|---|---|
| Cell refactor scope | Large — removes physics arrays, injects world dependency |
| New files | `src/connector.ts` + `src/physics.ts` |
| Force lag | Zero — all springs in one pass |
| Encapsulation | Cell has no physics state; world owns everything |
| Extensibility | Best — add springs and vertex blocks, no API changes |
| Debugging | Log world.positions slice for any entity |

**Best choice when:** the game has many cells and connectors, or when physical accuracy matters. Not chosen for the PoC because the Cell rewrite conflicts with the "straightforward code in first iterations" principle in CLAUDE.md.

---

## Summary comparison

| Concern | A: Force Buffer | B: Callbacks | C: Unified World |
|---|---|---|---|
| Cell changes | Minimal | Minimal | Significant |
| New files | 1 | 1 | 2 |
| Force lag | 1 frame | 0 (cell) / 1 (connector) | 0 |
| Coupling mechanism | `applyExternalForce()` | `registerForceContributor()` | None needed |
| Extensibility | Moderate | Good | Best |
| Chosen | **Yes** | No | No |
