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
    if (surfaceGap >= MAX_GAP) {
      this.graphics.hitArea = null
      return
    }

    const ax = dx / dist   // unit axis cell1 → cell2
    const ay = dy / dist
    const px = -ay         // perpendicular (90° CCW rotation)
    const py =  ax

    // Points on each cell's surface facing the other cell.
    // Clamped to at most half the centre-to-centre distance so the points
    // never cross when cells heavily overlap (which flips the rect into a spike).
    const reach = Math.min(RING_RADIUS, dist / 2)
    const t1x = c1.x + ax * reach,  t1y = c1.y + ay * reach
    const t2x = c2.x - ax * reach,  t2y = c2.y - ay * reach

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
