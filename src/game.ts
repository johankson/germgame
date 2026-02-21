import { Application } from 'pixi.js'
import { Cell } from './cell'
import { Input } from './input'

export function createGame(app: Application) {
  const params = new URLSearchParams(window.location.search)
  const vertexCount = Math.max(8, parseInt(params.get('v') ?? '32', 10))

  const debugEl = document.createElement('div')
  debugEl.textContent = `v7 — vertices: ${vertexCount}`
  debugEl.style.cssText = 'position:fixed;top:8px;left:8px;color:white;font:14px monospace;pointer-events:none;z-index:9999'
  document.body.appendChild(debugEl)

  const cell = new Cell(
    app.stage,
    app.screen.width / 2,
    app.screen.height / 2,
    vertexCount
  )

  const input = new Input()

  app.ticker.add(() => {
    const dir = input.direction()
    if (dir.x !== 0 || dir.y !== 0) {
      cell.applyMovement(dir)
    }
    cell.update()
  })
}
