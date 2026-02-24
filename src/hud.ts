import * as PIXI from 'pixi.js'

interface Vec2 { x: number; y: number }

export interface GameStats {
  elapsedFrames: number
  energy: number
  maxEnergy: number
  consumed: number
  fuseMode: boolean
}

// ── Arrow indicator constants ────────────────────────────────────────────────
const MARGIN        = 48
const ARROW_SIZE    = 14
const CLUSTER_RANGE = 220
const FADE_RANGE    = 100

// ── Scoreboard panel constants ───────────────────────────────────────────────
const PANEL_X  = 32
const PANEL_Y  = 32
const PANEL_W  = 376
const PAD_X    = 24
const PAD_Y    = 24
const FONT     = '"Press Start 2P"'
const FONT_SZ  = 16
const LINE_H   = 44   // px between stat rows
const HEADER_H = 40   // header row height + gap
const SEP_H    = 20   // gap below separator line
const ROWS     = 4
const PANEL_H  = PAD_Y + HEADER_H + SEP_H + ROWS * LINE_H + PAD_Y

export class Hud {
  private readonly arrowGraphics: PIXI.Graphics
  private readonly distLabel: PIXI.Text

  private readonly panel: PIXI.Graphics
  private readonly headerText: PIXI.Text
  private readonly statTexts: PIXI.Text[]
  private readonly modeText: PIXI.Text

  constructor(stage: PIXI.Container) {
    // Arrow indicator
    this.arrowGraphics = new PIXI.Graphics()
    stage.addChild(this.arrowGraphics)

    this.distLabel = new PIXI.Text({
      text: '',
      style: { fill: '#aaffcc', fontSize: 12, fontFamily: 'monospace' },
    })
    stage.addChild(this.distLabel)

    // Scoreboard panel
    this.panel = new PIXI.Graphics()
    stage.addChild(this.panel)

    this.headerText = new PIXI.Text({
      text: '> CELL.SYS',
      style: { fontFamily: FONT, fontSize: FONT_SZ, fill: '#997733' },
    })
    stage.addChild(this.headerText)

    this.statTexts = []
    for (let i = 0; i < ROWS; i++) {
      const t = new PIXI.Text({
        text: '',
        style: { fontFamily: FONT, fontSize: FONT_SZ, fill: '#aaffcc' },
      })
      stage.addChild(t)
      this.statTexts.push(t)
    }
    this.modeText = new PIXI.Text({
      text: '',
      style: { fontFamily: FONT, fontSize: FONT_SZ, fill: '#55ffaa' },
    })
    stage.addChild(this.modeText)
  }

  update(
    clusterWorld: Vec2,
    cameraPos: Vec2,
    screenW: number,
    screenH: number,
    stats: GameStats,
  ) {
    this.drawArrow(clusterWorld, cameraPos, screenW, screenH)
    this.drawScoreboard(stats)
  }

  // ── Off-screen cluster arrow ───────────────────────────────────────────────

  private drawArrow(clusterWorld: Vec2, cameraPos: Vec2, screenW: number, screenH: number) {
    const g = this.arrowGraphics
    g.clear()
    this.distLabel.text = ''

    const sx = screenW / 2 + clusterWorld.x - cameraPos.x
    const sy = screenH / 2 + clusterWorld.y - cameraPos.y

    const outsideX = Math.max(0, -sx, sx - screenW)
    const outsideY = Math.max(0, -sy, sy - screenH)
    const outside  = Math.max(outsideX, outsideY)

    const alpha = Math.min(1, Math.max(0, (outside - (CLUSTER_RANGE - FADE_RANGE)) / FADE_RANGE))
    if (alpha <= 0) return

    const dx = sx - screenW / 2
    const dy = sy - screenH / 2
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = dx / len
    const ny = dy / len

    const tx = nx !== 0 ? (screenW / 2 - MARGIN) / Math.abs(nx) : Infinity
    const ty = ny !== 0 ? (screenH / 2 - MARGIN) / Math.abs(ny) : Infinity
    const t  = Math.min(tx, ty)
    const ax = screenW / 2 + nx * t
    const ay = screenH / 2 + ny * t

    const cos = Math.cos(Math.atan2(ny, nx))
    const sin = Math.sin(Math.atan2(ny, nx))
    const s   = ARROW_SIZE
    g.setFillStyle({ color: 0xaaffcc, alpha: 0.85 * alpha })
    g.setStrokeStyle({ width: 1.5, color: 0xffffff, alpha: 0.4 * alpha })
    g.poly([
      ax + cos * s,                        ay + sin * s,
      ax - cos * s * 0.7 + sin * s * 0.7,  ay - sin * s * 0.7 - cos * s * 0.7,
      ax - cos * s * 0.7 - sin * s * 0.7,  ay - sin * s * 0.7 + cos * s * 0.7,
    ], true)
    g.fill()
    g.stroke()

    const dist = Math.round(Math.sqrt(
      (clusterWorld.x - cameraPos.x) ** 2 +
      (clusterWorld.y - cameraPos.y) ** 2,
    ))
    this.distLabel.text = `${dist} μm`
    this.distLabel.alpha = alpha
    this.distLabel.x = ax - nx * (s * 0.7 + 8) - this.distLabel.width  / 2
    this.distLabel.y = ay - ny * (s * 0.7 + 8) - this.distLabel.height / 2
  }

  // ── Scoreboard panel ──────────────────────────────────────────────────────

  private drawScoreboard(stats: GameStats) {
    const score    = stats.consumed * 10
    const totalSec = Math.floor(stats.elapsedFrames / 60)
    const mins     = Math.floor(totalSec / 60)
    const secs     = totalSec % 60
    const timeStr  = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

    // Per-frame flicker: subtle random brightness oscillation
    const flicker = 0.86 + (Math.random() - 0.5) * 0.14

    const g = this.panel
    g.clear()

    // Panel background
    g.setFillStyle({ color: 0x010b06, alpha: 0.92 })
    g.rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H)
    g.fill()

    // CRT scanlines — thin dark bands every 8 px across the panel
    g.setFillStyle({ color: 0x000000, alpha: 0.22 })
    for (let y = PANEL_Y + 1; y < PANEL_Y + PANEL_H - 1; y += 8) {
      g.rect(PANEL_X + 1, y, PANEL_W - 2, 2)
    }
    g.fill()

    // Panel border
    g.setStrokeStyle({ width: 1, color: 0x2d7a4a, alpha: 0.75 * flicker })
    g.rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H)
    g.stroke()

    // Corner accent pixels — small bright squares at each corner
    g.setFillStyle({ color: 0x55ffaa, alpha: 0.9 * flicker })
    g.rect(PANEL_X,                  PANEL_Y,                  6, 6)
    g.rect(PANEL_X + PANEL_W - 6,    PANEL_Y,                  6, 6)
    g.rect(PANEL_X,                  PANEL_Y + PANEL_H - 6,    6, 6)
    g.rect(PANEL_X + PANEL_W - 6,    PANEL_Y + PANEL_H - 6,    6, 6)
    g.fill()

    // Organic pixel noise on the border — appears randomly each frame
    if (Math.random() < 0.18) {
      const count = Math.floor(Math.random() * 3) + 1
      g.setFillStyle({ color: 0x88ffcc, alpha: 0.3 + Math.random() * 0.6 })
      for (let i = 0; i < count; i++) {
        // Pick a random perimeter position and snap to border edge
        const perim = 2 * (PANEL_W + PANEL_H)
        const pt    = Math.random() * perim
        let nx: number, ny: number
        if (pt < PANEL_W) {
          nx = PANEL_X + pt;            ny = PANEL_Y
        } else if (pt < PANEL_W + PANEL_H) {
          nx = PANEL_X + PANEL_W;       ny = PANEL_Y + (pt - PANEL_W)
        } else if (pt < 2 * PANEL_W + PANEL_H) {
          nx = PANEL_X + PANEL_W - (pt - PANEL_W - PANEL_H); ny = PANEL_Y + PANEL_H
        } else {
          nx = PANEL_X;                 ny = PANEL_Y + PANEL_H - (pt - 2 * PANEL_W - PANEL_H)
        }
        g.rect(Math.round(nx), Math.round(ny), 4, 4)
      }
      g.fill()
    }

    // Separator line below header
    const sepY = PANEL_Y + PAD_Y + HEADER_H
    g.setStrokeStyle({ width: 1, color: 0x1e5c33, alpha: 0.9 })
    g.moveTo(PANEL_X + PAD_X, sepY)
    g.lineTo(PANEL_X + PANEL_W - PAD_X, sepY)
    g.stroke()

    // Header text
    this.headerText.x     = PANEL_X + PAD_X
    this.headerText.y     = PANEL_Y + PAD_Y
    this.headerText.alpha = flicker

    // Stat rows — pad label to 10 chars so values align
    const rows: [string, string][] = [
      ['TIME',     timeStr],
      ['ENERGY',   `${stats.energy}/${stats.maxEnergy}`],
      ['CONSUMED', String(stats.consumed).padStart(4, '0')],
      ['SCORE',    String(score).padStart(5, '0')],
    ]

    const rowStartY = sepY + SEP_H
    for (let i = 0; i < ROWS; i++) {
      const [label, value] = rows[i]
      this.statTexts[i].text  = label.padEnd(10) + value
      this.statTexts[i].x     = PANEL_X + PAD_X
      this.statTexts[i].y     = rowStartY + i * LINE_H
      this.statTexts[i].alpha = flicker
    }
    if (stats.fuseMode) {
      const pulse = 0.7 + Math.sin(Date.now() / 200) * 0.3
      this.modeText.text  = '[F] FUSE'
      this.modeText.alpha = pulse
      // Right side of the header row
      this.modeText.x = PANEL_X + PANEL_W - PAD_X - 128
      this.modeText.y = PANEL_Y + PAD_Y
    } else {
      this.modeText.text = ''
    }
  }
}
