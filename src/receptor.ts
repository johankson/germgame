import * as PIXI from 'pixi.js'
import { Cell } from './cell'
import { NutrientPool } from './nutrients'

const ATTRACT_RADIUS = 150  // px — world nutrients pulled toward receptor within this range
const ATTRACT_FORCE  = 0.06 // velocity added per frame at maximum attraction
const INGEST_RADIUS  = 16   // px — nutrient enters cell when closer than this
const PULSE_PERIOD   = 80   // frames — glow pulse cycle when active

interface Vec2 { x: number; y: number }

export class Receptor {
  private readonly graphics: PIXI.Graphics
  private readonly vertexIdx: number
  private frameCount = 0

  constructor(stage: PIXI.Container, cell: Cell) {
    this.graphics = new PIXI.Graphics()
    stage.addChild(this.graphics)

    // Find the vertex of cell1 facing most leftward (away from cell2 at +x).
    const center = cell.getCenter()
    const vc     = cell.getVertexCount()
    let best = 0, bestDot = -Infinity
    for (let i = 0; i < vc; i++) {
      const p   = cell.getVertexPosition(i)
      const dot = -(p.x - center.x)   // dot with (-1, 0)
      if (dot > bestDot) { bestDot = dot; best = i }
    }
    this.vertexIdx = best
  }

  /** Returns the world position of the receptor's membrane vertex on the given cell. */
  getVertexPosition(cell: Cell): { x: number; y: number } {
    return cell.getSmoothedVertexPosition(this.vertexIdx)
  }

  update(cell: Cell, pool: NutrientPool): void {
    this.frameCount++
    const receptorPos = cell.getSmoothedVertexPosition(this.vertexIdx)
    const active      = !cell.isAtMaxEnergy()

    if (active) {
      for (const p of pool.particles) {
        if (p.state !== 'world') continue

        const dx   = receptorPos.x - p.x
        const dy   = receptorPos.y - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < ATTRACT_RADIUS) {
          // Force tapers off linearly with distance
          const strength = ATTRACT_FORCE * (1 - dist / ATTRACT_RADIUS)
          p.vx += (dx / dist) * strength
          p.vy += (dy / dist) * strength
        }

        if (dist < INGEST_RADIUS) {
          // Nutrient enters the cell — place it near the center
          p.state = 'inside'
          const c = cell.getCenter()
          p.x  = c.x + (Math.random() - 0.5) * 30
          p.y  = c.y + (Math.random() - 0.5) * 30
          p.vx = (Math.random() - 0.5) * 0.3
          p.vy = (Math.random() - 0.5) * 0.3
        }
      }
    }

    this.draw(receptorPos, active)
  }

  private draw(pos: Vec2, active: boolean): void {
    const g = this.graphics
    g.clear()

    // Pulse alpha so the receptor visually breathes when it is attracting
    const pulse  = active ? 0.65 + 0.35 * Math.sin((this.frameCount / PULSE_PERIOD) * Math.PI * 2) : 1
    const color  = active ? 0x88ffdd : 0x336655
    const alpha  = active ? 0.95 * pulse : 0.35
    const size   = active ? 7 : 4

    // Outer glow halo
    if (active) {
      g.setFillStyle({ color: 0x44ffcc, alpha: 0.12 * pulse })
      g.setStrokeStyle({ width: 0 })
      g.poly([
        pos.x,          pos.y - size * 2.4,
        pos.x + size * 2.4, pos.y,
        pos.x,          pos.y + size * 2.4,
        pos.x - size * 2.4, pos.y,
      ], true)
      g.fill()
    }

    // Diamond body
    g.setFillStyle({ color, alpha })
    g.setStrokeStyle({ width: 1.2, color: 0xffffff, alpha: alpha * 0.55 })
    g.poly([
      pos.x,        pos.y - size,
      pos.x + size, pos.y,
      pos.x,        pos.y + size,
      pos.x - size, pos.y,
    ], true)
    g.fill()
    g.stroke()
  }
  destroy(): void {
    this.graphics.destroy()
  }
}