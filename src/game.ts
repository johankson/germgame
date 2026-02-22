import { Application } from 'pixi.js'
import { Cell } from './cell'
import { Connector } from './connector'
import { Input } from './input'

export function createGame(app: Application) {
  const params = new URLSearchParams(window.location.search)
  const vertexCount = Math.max(8, parseInt(params.get('v') ?? '96', 10))

  const cx = app.screen.width / 2
  const cy = app.screen.height / 2

  // Cells sit close together so the connector gap is ~25% of the connector height.
  // With RING_RADIUS=100 and N≈3, connector height ≈ 39px; gap = height/4 ≈ 10px.
  // d = RING_RADIUS + gap/2 = 100 + 5 = 105.
  const cell1 = new Cell(app.stage, cx - 105, cy, vertexCount)
  const cell2 = new Cell(app.stage, cx + 105, cy, vertexCount)

  const connector = new Connector(app.stage, cell1, cell2)

  const input = new Input()

  app.ticker.add(() => {
    const dir = input.direction()
    if (dir.x !== 0 || dir.y !== 0) {
      cell1.applyMovement(dir)
    }

    // Soft repulsion: push cells apart when centers are closer than 2×RING_RADIUS.
    // Uses a spring-damper so the force settles instead of oscillating.
    const c1 = cell1.getCenter()
    const c2 = cell2.getCenter()
    const dx = c2.x - c1.x
    const dy = c2.y - c1.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
    if (dist < 200) {
      const nx = dx / dist
      const ny = dy / dist
      // Spring: proportional to overlap
      const springF = (200 - dist) * 0.2
      // Damper: oppose relative approach velocity along the collision normal
      const v1 = cell1.getCenterVelocity()
      const v2 = cell2.getCenterVelocity()
      const approachSpeed = (v1.x - v2.x) * nx + (v1.y - v2.y) * ny
      const dampF = approachSpeed * 0.5
      const f = springF + dampF
      const vc = cell1.getVertexCount()
      for (let i = 0; i < vc; i++) {
        cell1.applyExternalForce(i, -nx * f / vc, -ny * f / vc)
        cell2.applyExternalForce(i,  nx * f / vc,  ny * f / vc)
      }
    }

    // Connector runs first: injects attachment forces into cells before they integrate
    connector.update(cell1, cell2)
    cell1.update()
    cell2.update()
  })
}
