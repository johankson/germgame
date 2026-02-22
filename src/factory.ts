import * as PIXI from 'pixi.js'

const FACTORY_RADIUS = 12
const SPAWN_INTERVAL = 180   // frames — 3 s at 60 fps
const TRAVEL_FRAMES  = 90    // frames — 1.5 s travel time
const CURVE_BEND     = 30    // px — perpendicular offset for the bezier control point

interface Vec2 { x: number; y: number }
interface Cargo { progress: number }

export type FactoryShape = 'triangle' | 'square'

export class Factory {
  private graphics: PIXI.Graphics
  private frameCount = 0
  private cargo: Cargo[] = []
  private readonly shape: FactoryShape
  private readonly color: number
  private readonly bendSign: number  // +1 or -1 — curves line up or down

  constructor(stage: PIXI.Container, shape: FactoryShape, color: number, bendSign = 1) {
    this.shape    = shape
    this.color    = color
    this.bendSign = bendSign
    this.graphics = new PIXI.Graphics()
    stage.addChild(this.graphics)
  }

  update(factoryPos: Vec2, attachPoint: Vec2) {
    this.frameCount++

    if (this.frameCount % SPAWN_INTERVAL === 0) {
      this.cargo.push({ progress: 0 })
    }

    for (const c of this.cargo) {
      c.progress += 1 / TRAVEL_FRAMES
    }
    this.cargo = this.cargo.filter(c => c.progress <= 1)

    this.draw(factoryPos, attachPoint)
  }

  private draw(factoryPos: Vec2, attachPoint: Vec2) {
    const g = this.graphics
    g.clear()

    // Bezier control point: perpendicular offset at the midpoint
    const dx  = attachPoint.x - factoryPos.x
    const dy  = attachPoint.y - factoryPos.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const cpX = (factoryPos.x + attachPoint.x) / 2 - (dy / len) * CURVE_BEND * this.bendSign
    const cpY = (factoryPos.y + attachPoint.y) / 2 + (dx / len) * CURVE_BEND * this.bendSign
    const cp  = { x: cpX, y: cpY }

    // Connecting line
    g.setStrokeStyle({ width: 1.5, color: this.color, alpha: 0.6 })
    g.moveTo(factoryPos.x, factoryPos.y)
    g.quadraticCurveTo(cpX, cpY, attachPoint.x, attachPoint.y)
    g.stroke()

    // Organelle body
    g.setFillStyle({ color: this.color, alpha: 0.88 })
    g.setStrokeStyle({ width: 2, color: 0xffffff, alpha: 0.35 })
    g.circle(factoryPos.x, factoryPos.y, FACTORY_RADIUS)
    g.fill()
    g.stroke()
    // Inner membrane ring — gives it an organelle cross-section look
    g.setFillStyle({ color: 0x000000, alpha: 0.25 })
    g.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.2 })
    g.circle(factoryPos.x, factoryPos.y, FACTORY_RADIUS * 0.5)
    g.fill()
    g.stroke()

    // Cargo travelling along the bezier
    for (const c of this.cargo) {
      const pos     = bezierPoint(factoryPos, cp, attachPoint, c.progress)
      const tangent = bezierTangent(factoryPos, cp, attachPoint, c.progress)
      const angle   = Math.atan2(tangent.y, tangent.x)
      if (this.shape === 'triangle') {
        drawTriangle(g, pos.x, pos.y, 7, angle, this.color)
      } else {
        drawSquare(g, pos.x, pos.y, 8, angle, this.color)
      }
    }
  }
}

// Quadratic bezier position at t
function bezierPoint(p0: Vec2, p1: Vec2, p2: Vec2, t: number): Vec2 {
  const mt = 1 - t
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  }
}

// Quadratic bezier tangent (unnormalised) at t
function bezierTangent(p0: Vec2, p1: Vec2, p2: Vec2, t: number): Vec2 {
  const mt = 1 - t
  return {
    x: 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  }
}

// Triangle pointing in the direction of `angle`
function drawTriangle(g: PIXI.Graphics, x: number, y: number, size: number, angle: number, color: number) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const tip = [x + cos * size,                            y + sin * size                           ]
  const bl  = [x - cos * size * 0.6 - sin * size * 0.8,  y - sin * size * 0.6 + cos * size * 0.8 ]
  const br  = [x - cos * size * 0.6 + sin * size * 0.8,  y - sin * size * 0.6 - cos * size * 0.8 ]
  g.setFillStyle({ color })
  g.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.5 })
  g.poly([tip[0], tip[1], bl[0], bl[1], br[0], br[1]], true)
  g.fill()
  g.stroke()
}

// Square oriented to face the direction of `angle`
function drawSquare(g: PIXI.Graphics, x: number, y: number, size: number, angle: number, color: number) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const h   = size / 2
  const corners = [
    [x + cos * h - sin * h,  y + sin * h + cos * h],
    [x - cos * h - sin * h,  y - sin * h + cos * h],
    [x - cos * h + sin * h,  y - sin * h - cos * h],
    [x + cos * h + sin * h,  y + sin * h - cos * h],
  ]
  g.setFillStyle({ color })
  g.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.5 })
  g.poly(corners.flatMap(c => c), true)
  g.fill()
  g.stroke()
}
