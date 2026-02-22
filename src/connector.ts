import * as PIXI from 'pixi.js'
import { Cell } from './cell'

const EDGE_STIFFNESS = 0.3    // spring stiffness along columns
const STRUT_STIFFNESS = 0.4   // horizontal struts (maintains width, keeps cells apart)
const DIAG_STIFFNESS = 0.1    // diagonal cross-braces (shear resistance)
const ATTACH_STIFFNESS = 0.8  // attachment springs — only endpoints, so needs to be stiff
const DAMPING = 0.04          // velocity decay per frame

interface Vec2 { x: number; y: number }
interface Spring { a: number; b: number; restLen: number; stiffness: number }

// Vertex layout:
//   indices 0..n-1   = left column  (attached to cell1, top to bottom)
//   indices n..2n-1  = right column (attached to cell2, top to bottom)

export class Connector {
  private readonly n: number
  private positions: Vec2[]
  private velocities: Vec2[]
  private springs: Spring[]
  // Physics attaches only the top/bottom endpoints of each column to the cell.
  // All N interface indices are stored so draw() can read the full arc from the cell.
  private cell1Indices: [number, number]  // [topInterface, bottomInterface] — physics
  private cell2Indices: [number, number]
  private cell1AllIndices: number[]       // all N indices, top→bottom — rendering
  private cell2AllIndices: number[]
  private graphics: PIXI.Graphics
  private hovered = false

  constructor(stage: PIXI.Container, cell1: Cell, cell2: Cell) {
    // Connector height H = 2R·sin(π·(N-1)/vc). Target H ≈ 0.5R (25% of diameter).
    // Cell gap is set to H/4 in game.ts, giving a 4:1 height-to-width aspect ratio.
    const vc = cell1.getVertexCount()
    this.n = Math.max(2, Math.round(vc / Math.PI * Math.asin(0.25)))

    const all1 = selectInterfaceVertices(cell1, { x: 1, y: 0 }, this.n)
    this.cell1Indices = [all1[0], all1[this.n - 1]]
    this.cell1AllIndices = all1

    const all2 = selectInterfaceVertices(cell2, { x: -1, y: 0 }, this.n)
    this.cell2Indices = [all2[0], all2[this.n - 1]]
    this.cell2AllIndices = all2

    // Endpoints start at their cell attachment positions; intermediate vertices are
    // interpolated along the straight line between them — the natural rest state.
    this.positions = []
    this.velocities = []
    const l0 = cell1.getVertexPosition(this.cell1Indices[0])
    const l1 = cell1.getVertexPosition(this.cell1Indices[1])
    for (let i = 0; i < this.n; i++) {
      const t = i / (this.n - 1)
      this.positions.push({ x: l0.x + (l1.x - l0.x) * t, y: l0.y + (l1.y - l0.y) * t })
      this.velocities.push({ x: 0, y: 0 })
    }
    const r0 = cell2.getVertexPosition(this.cell2Indices[0])
    const r1 = cell2.getVertexPosition(this.cell2Indices[1])
    for (let i = 0; i < this.n; i++) {
      const t = i / (this.n - 1)
      this.positions.push({ x: r0.x + (r1.x - r0.x) * t, y: r0.y + (r1.y - r0.y) * t })
      this.velocities.push({ x: 0, y: 0 })
    }

    this.springs = []
    this.buildSprings()

    this.graphics = new PIXI.Graphics()
    // Render on top of cells so the connector is always visible and clickable
    stage.addChild(this.graphics)

    this.graphics.eventMode = 'static'
    this.graphics.on('pointerenter', () => { this.hovered = true })
    this.graphics.on('pointerleave', () => { this.hovered = false })
  }

  // Straight-line spacing between column endpoints divided equally over n-1 gaps.
  private columnUnit(startIdx: number): number {
    const top = this.positions[startIdx]
    const bot = this.positions[startIdx + this.n - 1]
    const dx = bot.x - top.x
    const dy = bot.y - top.y
    return Math.sqrt(dx * dx + dy * dy) / (this.n - 1)
  }

  private buildSprings() {
    const n = this.n

    // Straight-line unit length for each column.
    // Using this instead of arc distances makes the springs "want" a straight edge.
    const leftUnit = this.columnUnit(0)
    const rightUnit = this.columnUnit(n)

    // Left column: adjacent edge springs with straight-line rest length.
    // Intermediate vertices have no cell attachment, so a chain of equal springs
    // between the two anchored endpoints naturally forms a straight line.
    for (let i = 0; i < n - 1; i++) {
      this.springs.push({ a: i, b: i + 1, restLen: leftUnit, stiffness: EDGE_STIFFNESS })
    }

    // Right column: same
    for (let i = 0; i < n - 1; i++) {
      this.springs.push({ a: n + i, b: n + i + 1, restLen: rightUnit, stiffness: EDGE_STIFFNESS })
    }

    // Top and bottom closing edges (actual initial distance — these may deform freely)
    this.addSpring(0, n, EDGE_STIFFNESS)
    this.addSpring(n - 1, 2 * n - 1, EDGE_STIFFNESS)

    // Horizontal struts: left[i] <-> right[i]
    for (let i = 0; i < n; i++) {
      this.addSpring(i, i + n, STRUT_STIFFNESS)
    }
    // Diagonal cross-braces
    for (let i = 0; i < n - 1; i++) {
      this.addSpring(i, i + n + 1, DIAG_STIFFNESS)
      this.addSpring(i + 1, i + n, DIAG_STIFFNESS)
    }
  }

  // Uses actual current positions for rest length (struts, diagonals, closing edges).
  private addSpring(a: number, b: number, stiffness: number) {
    const dx = this.positions[b].x - this.positions[a].x
    const dy = this.positions[b].y - this.positions[a].y
    const restLen = Math.sqrt(dx * dx + dy * dy)
    this.springs.push({ a, b, restLen, stiffness })
  }

  update(cell1: Cell, cell2: Cell) {
    this.step(cell1, cell2)
    this.draw(cell1, cell2)
  }

  private step(cell1: Cell, cell2: Cell) {
    const n = this.n
    const forces: Vec2[] = Array.from({ length: 2 * n }, () => ({ x: 0, y: 0 }))

    // Internal springs
    for (const s of this.springs) {
      const dx = this.positions[s.b].x - this.positions[s.a].x
      const dy = this.positions[s.b].y - this.positions[s.a].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
      const stretch = dist - s.restLen
      const fx = (dx / dist) * stretch * s.stiffness
      const fy = (dy / dist) * stretch * s.stiffness
      forces[s.a].x += fx
      forces[s.a].y += fy
      forces[s.b].x -= fx
      forces[s.b].y -= fy
    }

    // Attachment springs: only the top (index 0) and bottom (index n-1) of each column
    // attach to the cell. Intermediate vertices stay straight via internal springs alone.
    const attachLeft: [number, number][] = [[0, this.cell1Indices[0]], [n - 1, this.cell1Indices[1]]]
    for (const [colIdx, cellIdx] of attachLeft) {
      const cp = cell1.getVertexPosition(cellIdx)
      const lp = this.positions[colIdx]
      const dx = lp.x - cp.x
      const dy = lp.y - cp.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
      const fx = (dx / dist) * dist * ATTACH_STIFFNESS
      const fy = (dy / dist) * dist * ATTACH_STIFFNESS
      forces[colIdx].x -= fx
      forces[colIdx].y -= fy
      cell1.applyExternalForce(cellIdx, fx, fy)
    }

    const attachRight: [number, number][] = [[n, this.cell2Indices[0]], [2 * n - 1, this.cell2Indices[1]]]
    for (const [colIdx, cellIdx] of attachRight) {
      const cp = cell2.getVertexPosition(cellIdx)
      const rp = this.positions[colIdx]
      const dx = rp.x - cp.x
      const dy = rp.y - cp.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
      const fx = (dx / dist) * dist * ATTACH_STIFFNESS
      const fy = (dy / dist) * dist * ATTACH_STIFFNESS
      forces[colIdx].x -= fx
      forces[colIdx].y -= fy
      cell2.applyExternalForce(cellIdx, fx, fy)
    }

    // Integrate
    for (let i = 0; i < 2 * n; i++) {
      this.velocities[i].x = (this.velocities[i].x + forces[i].x) * (1 - DAMPING)
      this.velocities[i].y = (this.velocities[i].y + forces[i].y) * (1 - DAMPING)
      this.positions[i].x += this.velocities[i].x
      this.positions[i].y += this.velocities[i].y
    }
  }

  private draw(cell1: Cell, cell2: Cell) {
    const g = this.graphics
    g.clear()

    // Axis vector pointing from cell1 toward cell2 (normalised)
    const c1 = cell1.getCenter()
    const c2 = cell2.getCenter()
    const adx = c2.x - c1.x
    const ady = c2.y - c1.y
    const alen = Math.sqrt(adx * adx + ady * ady) || 1
    const ax = adx / alen
    const ay = ady / alen

    // Hit area: circle at connector midpoint — updated every frame as cells move
    const midX = (c1.x + c2.x) / 2
    const midY = (c1.y + c2.y) / 2
    this.graphics.hitArea = new PIXI.Circle(midX, midY, 28)

    // Extend each edge EXTEND px into its own cell along the connector axis,
    // so the connector visibly overlaps the cell surfaces and is always clickable.
    const EXTEND = 8

    const points: number[] = []
    for (const idx of this.cell1AllIndices) {
      const p = cell1.getSmoothedVertexPosition(idx)
      points.push(p.x - ax * EXTEND, p.y - ay * EXTEND)
    }
    for (let i = this.cell2AllIndices.length - 1; i >= 0; i--) {
      const p = cell2.getSmoothedVertexPosition(this.cell2AllIndices[i])
      points.push(p.x + ax * EXTEND, p.y + ay * EXTEND)
    }

    const fill   = this.hovered ? 0x88ccff : 0x4488ff
    const stroke = this.hovered ? 0xffffff : 0x0066cc
    const alpha  = this.hovered ? 0.9 : 0.6

    g.setStrokeStyle({ width: this.hovered ? 3 : 2, color: stroke })
    g.setFillStyle({ color: fill, alpha })
    g.poly(points, true)
    g.fill()
    g.stroke()
  }
}

// Returns n vertex indices on `cell` most facing `direction`, sorted top-to-bottom by y.
function selectInterfaceVertices(cell: Cell, direction: Vec2, n: number): number[] {
  const center = cell.getCenter()
  const count = cell.getVertexCount()

  const scored: { index: number; dot: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    const p = cell.getVertexPosition(i)
    const dot = (p.x - center.x) * direction.x + (p.y - center.y) * direction.y
    scored.push({ index: i, dot, y: p.y })
  }

  scored.sort((a, b) => b.dot - a.dot)
  const top = scored.slice(0, n)
  top.sort((a, b) => a.y - b.y)

  return top.map(s => s.index)
}
