import * as PIXI from 'pixi.js'
import { Cell } from './cell'

const WORLD_COUNT   = 30    // target number of nutrients floating in the fluid
const SPAWN_RADIUS  = 500   // max world-space radius for initial scatter
const SPAWN_CLEAR   = 150   // min distance from origin (keep clear of cells at spawn)
const SPEED_CAP_WORLD  = 0.8
const SPEED_CAP_INSIDE = 0.5
const NUTRIENT_SIZE = 6

export interface NutrientParticle {
  x: number; y: number
  vx: number; vy: number
  angle: number; angularV: number
  state: 'world' | 'inside'
}

export class NutrientPool {
  private readonly graphics: PIXI.Graphics
  readonly particles: NutrientParticle[] = []

  constructor(stage: PIXI.Container) {
    this.graphics = new PIXI.Graphics()
    stage.addChild(this.graphics)

    for (let i = 0; i < WORLD_COUNT; i++) this.spawnWorld()
  }

  private spawnWorld(): void {
    const a = Math.random() * Math.PI * 2
    const r = SPAWN_CLEAR + Math.random() * (SPAWN_RADIUS - SPAWN_CLEAR)
    this.particles.push({
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      angle: Math.random() * Math.PI * 2,
      angularV: (Math.random() - 0.5) * 0.025,
      state: 'world',
    })
  }

  update(cell: Cell): void {
    for (const p of this.particles) {
      if (p.state === 'world') {
        // Gentle brownian drift
        p.vx += (Math.random() - 0.5) * 0.06
        p.vy += (Math.random() - 0.5) * 0.06
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (spd > SPEED_CAP_WORLD) { p.vx = p.vx / spd * SPEED_CAP_WORLD; p.vy = p.vy / spd * SPEED_CAP_WORLD }

        // Bounce off the cell wall — world nutrients cannot pass through the membrane.
        if (cell.containsPoint({ x: p.x, y: p.y })) {
          const c = cell.getCenter()
          const dx = p.x - c.x
          const dy = p.y - c.y
          const len = Math.sqrt(dx * dx + dy * dy) || 1
          p.vx = (dx / len) * 0.5
          p.vy = (dy / len) * 0.5
          p.x += p.vx * 5
          p.y += p.vy * 5
          continue
        }
      } else {
        // Inside cell: more agitated brownian, bounce off membrane
        p.vx += (Math.random() - 0.5) * 0.10
        p.vy += (Math.random() - 0.5) * 0.10
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (spd > SPEED_CAP_INSIDE) { p.vx = p.vx / spd * SPEED_CAP_INSIDE; p.vy = p.vy / spd * SPEED_CAP_INSIDE }

        if (!cell.containsPoint({ x: p.x, y: p.y })) {
          const c = cell.getCenter()
          const dx = c.x - p.x
          const dy = c.y - p.y
          const len = Math.sqrt(dx * dx + dy * dy) || 1
          // Redirect velocity toward center and nudge back inside in one step.
          // `continue` skips the unconditional integration below to avoid double-counting.
          p.vx = (dx / len) * 0.5
          p.vy = (dy / len) * 0.5
          p.x += p.vx * 5
          p.y += p.vy * 5
          continue
        }
      }

      p.x += p.vx
      p.y += p.vy
      p.angle += p.angularV
    }

    // Maintain world count
    const worldCount = this.particles.filter(p => p.state === 'world').length
    if (worldCount < WORLD_COUNT) this.spawnWorld()

    this.draw()
  }

  private draw(): void {
    const g = this.graphics
    g.clear()
    for (const p of this.particles) {
      const alpha = p.state === 'world' ? 0.88 : 0.50
      drawNutrient(g, p.x, p.y, p.angle, alpha)
    }
  }
}

function drawNutrient(g: PIXI.Graphics, x: number, y: number, angle: number, alpha: number): void {
  const s   = NUTRIENT_SIZE
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  g.setFillStyle({ color: 0xffffff, alpha: alpha * 0.92 })
  g.setStrokeStyle({ width: 0.5, color: 0xaaddff, alpha: alpha * 0.5 })
  g.poly([
    x + cos * s,                         y + sin * s,
    x - cos * s * 0.6 - sin * s * 0.8,  y - sin * s * 0.6 + cos * s * 0.8,
    x - cos * s * 0.6 + sin * s * 0.8,  y - sin * s * 0.6 - cos * s * 0.8,
  ], true)
  g.fill()
  g.stroke()
}
