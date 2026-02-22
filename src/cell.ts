import * as PIXI from 'pixi.js'

const RING_RADIUS = 100
const EDGE_STIFFNESS = 0.3   // perimeter spring strength
const RADIAL_STIFFNESS = 0.1 // pull toward ring radius from center
const DAMPING = 0.04         // velocity decay per frame (liquid drag)
const MOVE_FORCE = 0.5       // velocity impulse applied to leading-edge vertices
const ANGULAR_DAMPING = 0.015 // rotational velocity decay — lower than DAMPING so spin persists
const SMOOTH_RADIUS = 6      // box-filter half-width used in rendering

interface Vec2 { x: number; y: number }

export class Cell {
  private positions: Vec2[]
  private velocities: Vec2[]
  private pendingExternalForces: Vec2[]
  private angularVelocity = 0
  private hovered = false
  private graphics: PIXI.Graphics
  private readonly vertexCount: number
  private readonly restEdgeLength: number

  constructor(stage: PIXI.Container, cx: number, cy: number, vertexCount = 32) {
    this.vertexCount = vertexCount
    this.restEdgeLength = (2 * Math.PI * RING_RADIUS) / vertexCount
    this.positions = []
    this.velocities = []
    this.pendingExternalForces = []

    for (let i = 0; i < vertexCount; i++) {
      const angle = (i / vertexCount) * Math.PI * 2
      this.positions.push({
        x: cx + Math.cos(angle) * RING_RADIUS,
        y: cy + Math.sin(angle) * RING_RADIUS,
      })
      this.velocities.push({ x: 0, y: 0 })
      this.pendingExternalForces.push({ x: 0, y: 0 })
    }

    this.graphics = new PIXI.Graphics()
    stage.addChild(this.graphics)

    this.graphics.eventMode = 'static'
    this.graphics.on('pointerenter', () => { this.hovered = true })
    this.graphics.on('pointerleave', () => { this.hovered = false })
  }

  getVertexCount(): number { return this.vertexCount }

  getVertexPosition(i: number): Vec2 {
    return { x: this.positions[i].x, y: this.positions[i].y }
  }

  // Same box filter used in draw() — lets joined geometry agree on one render position.
  getSmoothedVertexPosition(i: number): Vec2 {
    const n = this.vertexCount
    let x = 0, y = 0
    for (let k = -SMOOTH_RADIUS; k <= SMOOTH_RADIUS; k++) {
      const j = (i + k + n) % n
      x += this.positions[j].x
      y += this.positions[j].y
    }
    return { x: x / (2 * SMOOTH_RADIUS + 1), y: y / (2 * SMOOTH_RADIUS + 1) }
  }

  applyExternalForce(i: number, fx: number, fy: number): void {
    this.pendingExternalForces[i].x += fx
    this.pendingExternalForces[i].y += fy
  }

  getCenterVelocity(): Vec2 {
    let vx = 0, vy = 0
    for (const v of this.velocities) {
      vx += v.x
      vy += v.y
    }
    return { x: vx / this.vertexCount, y: vy / this.vertexCount }
  }

  getCenter(): Vec2 {
    let x = 0
    let y = 0
    for (const p of this.positions) {
      x += p.x
      y += p.y
    }
    return { x: x / this.vertexCount, y: y / this.vertexCount }
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

    // Consume external forces injected by Connector this frame
    for (let i = 0; i < this.vertexCount; i++) {
      forces[i].x += this.pendingExternalForces[i].x
      forces[i].y += this.pendingExternalForces[i].y
      this.pendingExternalForces[i].x = 0
      this.pendingExternalForces[i].y = 0
    }

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

    // Angular momentum: accumulate torque (r × F) and moment of inertia (Σ r²),
    // then integrate angular velocity separately from linear velocity so each
    // can damp at its own rate.
    let torque = 0
    let inertia = 0
    for (let i = 0; i < this.vertexCount; i++) {
      const rx = this.positions[i].x - center.x
      const ry = this.positions[i].y - center.y
      torque += rx * forces[i].y - ry * forces[i].x
      inertia += rx * rx + ry * ry
    }
    this.angularVelocity = (this.angularVelocity + torque / (inertia || 1)) * (1 - ANGULAR_DAMPING)

    // Integrate: linear velocity + angular tangential contribution → new position
    for (let i = 0; i < this.vertexCount; i++) {
      this.velocities[i].x = (this.velocities[i].x + forces[i].x) * (1 - DAMPING)
      this.velocities[i].y = (this.velocities[i].y + forces[i].y) * (1 - DAMPING)
      const rx = this.positions[i].x - center.x
      const ry = this.positions[i].y - center.y
      this.positions[i].x += this.velocities[i].x - ry * this.angularVelocity
      this.positions[i].y += this.velocities[i].y + rx * this.angularVelocity
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

    // Hit area: circle at cell center, updated every frame as the cell moves
    const center = this.getCenter()
    this.graphics.hitArea = new PIXI.Circle(center.x, center.y, RING_RADIUS)

    // Smooth rendered positions with a box filter over neighbours.
    // Physics positions are unchanged — this is purely a visual trick.
    const n = this.vertexCount
    const r = SMOOTH_RADIUS
    const points: number[] = []
    for (let i = 0; i < n; i++) {
      let x = 0, y = 0
      for (let k = -r; k <= r; k++) {
        const j = (i + k + n) % n
        x += this.positions[j].x
        y += this.positions[j].y
      }
      points.push(x / (2 * r + 1), y / (2 * r + 1))
    }

    const fill   = this.hovered ? 0x88ffaa : 0x44ff88
    const stroke = this.hovered ? 0xffffff : 0x00cc44
    const alpha  = this.hovered ? 0.85 : 0.6

    g.setStrokeStyle({ width: this.hovered ? 3 : 2, color: stroke })
    g.setFillStyle({ color: fill, alpha })
    g.poly(points, true)
    g.fill()
    g.stroke()
  }

}
