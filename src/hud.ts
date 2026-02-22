import * as PIXI from 'pixi.js'

interface Vec2 { x: number; y: number }

const MARGIN        = 48   // px from screen edge where arrow tip sits
const ARROW_SIZE    = 14   // px — arrowhead length
const CLUSTER_RANGE = 220  // px outside screen where indicator reaches full alpha
const FADE_RANGE    = 100  // px — fade-in zone width before CLUSTER_RANGE

export class Hud {
  private readonly graphics: PIXI.Graphics
  private readonly label: PIXI.Text

  constructor(stage: PIXI.Container) {
    this.graphics = new PIXI.Graphics()
    stage.addChild(this.graphics)

    this.label = new PIXI.Text({
      text: '',
      style: { fill: '#aaffcc', fontSize: 12, fontFamily: 'monospace' },
    })
    stage.addChild(this.label)
  }

  update(clusterWorld: Vec2, cameraPos: Vec2, screenW: number, screenH: number) {
    const g = this.graphics
    g.clear()
    this.label.text = ''

    // Cluster position in screen space
    const sx = screenW / 2 + clusterWorld.x - cameraPos.x
    const sy = screenH / 2 + clusterWorld.y - cameraPos.y

    // How far (px) the cluster centre sits outside the screen bounds
    const outsideX = Math.max(0, -sx, sx - screenW)
    const outsideY = Math.max(0, -sy, sy - screenH)
    const outside  = Math.max(outsideX, outsideY)

    // Fade from 0→1 as the cluster moves from (CLUSTER_RANGE - FADE_RANGE) to CLUSTER_RANGE
    // pixels outside the viewport. Fully hidden when cells are clearly on screen.
    const alpha = Math.min(1, Math.max(0, (outside - (CLUSTER_RANGE - FADE_RANGE)) / FADE_RANGE))
    if (alpha <= 0) return

    // Unit vector from screen center toward cluster
    const dx = sx - screenW / 2
    const dy = sy - screenH / 2
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = dx / len
    const ny = dy / len

    // Intersect ray with the inset screen rectangle to find arrow position
    const tx = nx !== 0 ? (screenW / 2 - MARGIN) / Math.abs(nx) : Infinity
    const ty = ny !== 0 ? (screenH / 2 - MARGIN) / Math.abs(ny) : Infinity
    const t  = Math.min(tx, ty)
    const ax = screenW / 2 + nx * t
    const ay = screenH / 2 + ny * t

    // Arrowhead triangle pointing toward the cluster
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

    // Distance label: offset so its near edge clears the arrow base by 8 px
    const dist = Math.round(Math.sqrt(
      (clusterWorld.x - cameraPos.x) ** 2 +
      (clusterWorld.y - cameraPos.y) ** 2,
    ))
    this.label.text = `${dist} μm`
    this.label.alpha = alpha
    this.label.x = ax - nx * (s * 0.7 + 8 + this.label.width  / 2) - this.label.width  / 2
    this.label.y = ay - ny * (s * 0.7 + 8 + this.label.height / 2) - this.label.height / 2
  }
}
