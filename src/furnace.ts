import * as PIXI from 'pixi.js'
import { Cell } from './cell'
import { NutrientPool } from './nutrients'

// The Furnace (Mitochondrion) is an energy-processing organelle inside the cell.
// It consumes ingested nutrients and converts them into stored cell energy.

const FURNACE_RADIUS  = 12
const CONSUME_RADIUS  = 40   // px — furnace digests nutrients within this range
const CONSUME_COOLDOWN = 240  // frames between consumptions (~4 s) — lets nutrients float visibly

interface Vec2 { x: number; y: number }

export class Furnace {
  private readonly graphics: PIXI.Graphics
  private pulseFrames  = 0   // countdown for consumption glow
  private cooldown     = CONSUME_COOLDOWN  // starts full so first nutrient has time to float
  private totalConsumed = 0

  getConsumed(): number { return this.totalConsumed }

  constructor(stage: PIXI.Container) {
    this.graphics = new PIXI.Graphics()
    stage.addChild(this.graphics)
  }

  update(pos: Vec2, cell: Cell, pool: NutrientPool): void {
    if (this.pulseFrames > 0) this.pulseFrames--
    // Timer always counts down so nutrients have time to float before being consumed.
    this.cooldown--
    if (this.cooldown <= 0) {
      this.cooldown = CONSUME_COOLDOWN  // reset whether or not we consumed

      // Find the closest inside nutrient within range
      let closest: { idx: number; dist: number } | null = null
      for (let i = 0; i < pool.particles.length; i++) {
        const p = pool.particles[i]
        if (p.state !== 'inside') continue
        const dx   = pos.x - p.x
        const dy   = pos.y - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < CONSUME_RADIUS && (closest === null || dist < closest.dist)) {
          closest = { idx: i, dist }
        }
      }

      if (closest !== null) {
        pool.particles.splice(closest.idx, 1)
        cell.addEnergy(1)
        this.totalConsumed++
        this.pulseFrames = 35
      }
    }

    this.draw(pos)
  }

  private draw(pos: Vec2): void {
    const g         = this.graphics
    g.clear()

    const isPulsing = this.pulseFrames > 0
    const pulseT    = this.pulseFrames / 35  // 0..1

    // Outer consumption glow
    if (isPulsing) {
      g.setFillStyle({ color: 0xff7722, alpha: pulseT * 0.28 })
      g.setStrokeStyle({ width: 0 })
      g.circle(pos.x, pos.y, FURNACE_RADIUS * 2.8)
      g.fill()
    }

    // Hexagonal body
    const sides = 6
    const r     = FURNACE_RADIUS + (isPulsing ? pulseT * 2.5 : 0)
    const pts: number[] = []
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 6
      pts.push(pos.x + Math.cos(a) * r, pos.y + Math.sin(a) * r)
    }
    const bodyColor = isPulsing ? 0xff7733 : 0xff5533
    g.setFillStyle({ color: bodyColor, alpha: 0.92 })
    g.setStrokeStyle({ width: 2, color: 0xffcc88, alpha: isPulsing ? 0.85 : 0.38 })
    g.poly(pts, true)
    g.fill()
    g.stroke()

    // Inner dark core
    g.setFillStyle({ color: 0x1a0800, alpha: 0.45 })
    g.setStrokeStyle({ width: 1, color: 0xff8844, alpha: 0.28 })
    g.circle(pos.x, pos.y, FURNACE_RADIUS * 0.42)
    g.fill()
    g.stroke()
  }
}
