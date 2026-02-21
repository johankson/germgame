import * as PIXI from 'pixi.js'

const RING_RADIUS = 100
const EDGE_STIFFNESS = 0.3   // perimeter spring strength
const RADIAL_STIFFNESS = 0.1 // pull toward ring radius from center
const DAMPING = 0.04         // velocity decay per frame (liquid drag)
const MOVE_FORCE = 0.5       // velocity impulse applied to leading-edge vertices

interface Vec2 { x: number; y: number }

export class Cell {
  private positions: Vec2[]
  private velocities: Vec2[]
  private graphics: PIXI.Graphics
  private readonly vertexCount: number
  private readonly restEdgeLength: number

  constructor(stage: PIXI.Container, cx: number, cy: number, vertexCount = 32) {
    this.vertexCount = vertexCount
    this.restEdgeLength = (2 * Math.PI * RING_RADIUS) / vertexCount
    this.positions = []
    this.velocities = []

    for (let i = 0; i < vertexCount; i++) {
      const angle = (i / vertexCount) * Math.PI * 2
      this.positions.push({
        x: cx + Math.cos(angle) * RING_RADIUS,
        y: cy + Math.sin(angle) * RING_RADIUS,
      })
      this.velocities.push({ x: 0, y: 0 })
    }

    this.graphics = new PIXI.Graphics()
    stage.addChild(this.graphics)
  }

  applyMovement(dir: Vec2) {
    const center = this.getCenter()
    for (let i = 0; i < this.vertexCount; i++) {
      const dx = this.positions[i].x - center.x
      const dy = this.positions[i].y - center.y
      if (dx * dir.x + dy * dir.y > 0) {
        this.velocities[i].x += dir.x * MOVE_FORCE
        this.velocities[i].y += dir.y * MOVE_FORCE
      }
    }
  }

  update() {
    this.step()
    this.draw()
  }

  private step() {
    const center = this.getCenter()
    const forces: Vec2[] = Array.from({ length: this.vertexCount }, () => ({ x: 0, y: 0 }))

    // Edge springs — keep adjacent vertices at rest arc length
    for (let i = 0; i < this.vertexCount; i++) {
      const j = (i + 1) % this.vertexCount
      const dx = this.positions[j].x - this.positions[i].x
      const dy = this.positions[j].y - this.positions[i].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
      const stretch = dist - this.restEdgeLength
      const fx = (dx / dist) * stretch * EDGE_STIFFNESS
      const fy = (dy / dist) * stretch * EDGE_STIFFNESS
      forces[i].x += fx
      forces[i].y += fy
      forces[j].x -= fx
      forces[j].y -= fy
    }

    // Radial springs — pull each vertex toward RING_RADIUS from center.
    // This acts as internal cell pressure and crucially prevents vertices
    // from crossing to the other side of the cell.
    for (let i = 0; i < this.vertexCount; i++) {
      const dx = this.positions[i].x - center.x
      const dy = this.positions[i].y - center.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
      const stretch = dist - RING_RADIUS
      forces[i].x -= (dx / dist) * stretch * RADIAL_STIFFNESS
      forces[i].y -= (dy / dist) * stretch * RADIAL_STIFFNESS
    }

    // Integrate: apply forces, damp, move
    for (let i = 0; i < this.vertexCount; i++) {
      this.velocities[i].x = (this.velocities[i].x + forces[i].x) * (1 - DAMPING)
      this.velocities[i].y = (this.velocities[i].y + forces[i].y) * (1 - DAMPING)
      this.positions[i].x += this.velocities[i].x
      this.positions[i].y += this.velocities[i].y
    }

    // Post-physics correction: fix any crossings by checking the cross product
    // of adjacent vertices around the center. If negative, they've swapped angular
    // order — move both to their midpoint and average velocities.
    // Multiple passes handle cascading crossings.
    for (let pass = 0; pass < 3; pass++) {
      const c = this.getCenter()
      for (let i = 0; i < this.vertexCount; i++) {
        const j = (i + 1) % this.vertexCount
        const ax = this.positions[i].x - c.x
        const ay = this.positions[i].y - c.y
        const bx = this.positions[j].x - c.x
        const by = this.positions[j].y - c.y
        // Cross product: negative means i and j have swapped angular order
        if (ax * by - ay * bx < 0) {
          const mx = (this.positions[i].x + this.positions[j].x) / 2
          const my = (this.positions[i].y + this.positions[j].y) / 2
          this.positions[i].x = mx
          this.positions[i].y = my
          this.positions[j].x = mx
          this.positions[j].y = my
          const vx = (this.velocities[i].x + this.velocities[j].x) / 2
          const vy = (this.velocities[i].y + this.velocities[j].y) / 2
          this.velocities[i].x = vx
          this.velocities[i].y = vy
          this.velocities[j].x = vx
          this.velocities[j].y = vy
        }
      }
    }
  }

  private draw() {
    const g = this.graphics
    g.clear()

    const points: number[] = []
    for (const p of this.positions) {
      points.push(p.x, p.y)
    }

    g.setStrokeStyle({ width: 2, color: 0xcc0000 })
    g.setFillStyle({ color: 0xff4444, alpha: 0.6 })
    g.poly(points, true)
    g.fill()
    g.stroke()
  }

  private getCenter(): Vec2 {
    let x = 0
    let y = 0
    for (const p of this.positions) {
      x += p.x
      y += p.y
    }
    return { x: x / this.vertexCount, y: y / this.vertexCount }
  }
}
