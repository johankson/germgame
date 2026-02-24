import * as PIXI from 'pixi.js'
import { Application, Container } from 'pixi.js'
import { Cell } from './cell'
import { Connector } from './connector'
import { Factory } from './factory'
import { Furnace } from './furnace'
import { Hud } from './hud'
import { Input } from './input'
import { NutrientPool } from './nutrients'
import { Receptor } from './receptor'

const CAMERA_ACCEL    = 1.0   // px/frame added each frame while key held
const CAMERA_FRICTION = 0.90  // velocity multiplier per frame — controls deceleration feel

export function createGame(app: Application) {
  const params = new URLSearchParams(window.location.search)
  const vertexCount = Math.max(8, parseInt(params.get('v') ?? '96', 10))

  // World container: all game entities live here.
  // Panning this container is the camera.
  const worldContainer = new Container()
  app.stage.addChild(worldContainer)

  // HUD container: fixed to screen, drawn on top of the world.
  const hudContainer = new Container()
  app.stage.addChild(hudContainer)

  // Nutrients are added first so they render under the (translucent) cells.
  // Inside nutrients are then visible as dim shapes through the membrane.
  const nutrientPool = new NutrientPool(worldContainer)

  // Cells spawn at world origin — the camera starts centred there.
  const cell1 = new Cell(worldContainer, -105, 0, vertexCount)
  const cell2 = new Cell(worldContainer,  105, 0, vertexCount)

  const bonds: Array<{ c: Connector; a: Cell; b: Cell }> = []
  // Add a bond between two cells unless one already exists for this pair.
  function addBond(a: Cell, b: Cell) {
    if (bonds.some(bond => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a))) return
    bonds.push({ c: new Connector(worldContainer), a, b })
  }
  // cell1 and cell2 start bonded at game creation
  addBond(cell1, cell2)

  // Furnace (Mitochondrion) replaces the old triangle factory.
  // Square factory (ribosome) is kept.
  const furnace       = new Furnace(worldContainer)
  const squareFactory = new Factory(worldContainer, 'square', 0x44aaff, -1)

  // Receptor is drawn on top of everything world-side so it's always visible.
  let receptor = new Receptor(worldContainer, cell1)

  const hud   = new Hud(hudContainer)
  const input = new Input()

  // Screen-space mouse position — updated on mousemove
  const mouse = { screenX: 0, screenY: 0 }
  app.canvas.addEventListener('mousemove', (e: MouseEvent) => {
    const rect = (app.canvas as HTMLCanvasElement).getBoundingClientRect()
    mouse.screenX = e.clientX - rect.left
    mouse.screenY = e.clientY - rect.top
  })

  // Tracks all live cells for update/draw
  const cells: Cell[] = [cell1, cell2]

  // Which cell each organelle currently belongs to
  let furnaceOwner = cell1
  let receptorOwner = cell1
  // factoryOwner is omitted — factory is cosmetic, always anchored to cell1 area

  // Division preview state
  let divisionTarget: Cell | null = null

  const divisionGraphics = new PIXI.Graphics()
  worldContainer.addChild(divisionGraphics)

  // Camera state: world-space position the camera is looking at.
  const cameraPos = { x: 0, y: 0 }
  const cameraVel = { x: 0, y: 0 }
  let elapsedFrames = 0

  function drawSplitPreview(g: PIXI.Graphics, cell: Cell, mouseWorld: { x: number; y: number }): void {
    const center = cell.getCenter()
    const dx = mouseWorld.x - center.x
    const dy = mouseWorld.y - center.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    // Split axis is perpendicular to the mouse direction
    const ax = -dy / len
    const ay =  dx / len

    // Pulsing dotted line — small squares at intervals along the axis
    const alpha = 0.65 + Math.sin(Date.now() / 150) * 0.25
    g.setFillStyle({ color: 0xccffee, alpha })
    const DASH = 5, GAP = 5
    for (let d = -120; d <= 120; d += DASH + GAP) {
      g.rect(center.x + ax * d - 2, center.y + ay * d - 2, 4, 4)
    }
    g.fill()
  }


  let flashFrames = 0
  let flashAxis: { cx: number; cy: number; ax: number; ay: number } | null = null

  function executeDiv(cell: Cell, mouseWorld: { x: number; y: number }): void {
    const center = cell.getCenter()
    const dx = mouseWorld.x - center.x
    const dy = mouseWorld.y - center.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const mdx = dx / len   // unit vector pointing toward mouse (new-cell side)
    const mdy = dy / len

    // Helper: is a world-space point on the "new cell" (mouse) side of the split?
    const onNewSide = (px: number, py: number) =>
      (px - center.x) * mdx + (py - center.y) * mdy > 0

    // Organelle positions as used in the ticker (fixed offsets from cell center)
    const furnacePos  = { x: center.x, y: center.y - 20 }
    const receptorPos = receptor.getVertexPosition(receptorOwner)

    const furnaceTransfers  = furnaceOwner === cell  && onNewSide(furnacePos.x,  furnacePos.y)
    const receptorTransfers = receptorOwner === cell && onNewSide(receptorPos.x, receptorPos.y)

    // Spawn daughter at same centre, 50% radius, slightly offset toward mouse
    const OFFSET = 18
    const newCell = new Cell(
      worldContainer,
      center.x + mdx * OFFSET,
      center.y + mdy * OFFSET,
      vertexCount,
      50,
    )
    cells.push(newCell)

    // Bond parent and daughter immediately — bridge is purely visual so no deferral needed
    addBond(cell, newCell)

    // Outward velocity impulse so the daughter drifts away
    const IMPULSE = 2.0
    for (let i = 0; i < vertexCount; i++) {
      newCell.applyExternalForce(i, mdx * IMPULSE, mdy * IMPULSE)
    }

    // Reassign organelles
    if (furnaceTransfers)  furnaceOwner = newCell
    if (receptorTransfers) {
      receptor.destroy()
      receptor      = new Receptor(worldContainer, newCell)
      receptorOwner = newCell
    }

    // Store flash info for Task 7
    flashFrames = 20
    flashAxis   = { cx: center.x, cy: center.y, ax: -mdy, ay: mdx }
  }

  app.ticker.add(() => {
    elapsedFrames++
    // Arrow keys accelerate the camera; friction decelerates it when released.
    const dir = input.direction()
    cameraVel.x = (cameraVel.x + dir.x * CAMERA_ACCEL) * CAMERA_FRICTION
    cameraVel.y = (cameraVel.y + dir.y * CAMERA_ACCEL) * CAMERA_FRICTION
    cameraPos.x += cameraVel.x
    cameraPos.y += cameraVel.y

    // Shift the world container so cameraPos sits at the screen centre.
    worldContainer.x = app.screen.width  / 2 - cameraPos.x
    worldContainer.y = app.screen.height / 2 - cameraPos.y

    // Connector attraction: pull linked cells together when they stretch beyond the rest gap.
    // Mirrors the repulsion loop below — same pattern, opposite sign.
    const LINK_K    = 0.3   // spring stiffness
    const LINK_REST = 220   // px centre-to-centre — natural resting gap
    for (const { a, b } of bonds) {
      const ca = a.getCenter()
      const cb = b.getCenter()
      const dx = cb.x - ca.x
      const dy = cb.y - ca.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
      if (dist > LINK_REST) {
        const nx = dx / dist
        const ny = dy / dist
        const f  = (dist - LINK_REST) * LINK_K
        const vc = a.getVertexCount()
        for (let i = 0; i < vc; i++) {
          a.applyExternalForce(i,  nx * f / vc,  ny * f / vc)
          b.applyExternalForce(i, -nx * f / vc, -ny * f / vc)
        }
      }
    }

    // Soft repulsion: push all cell pairs apart when centres are closer than 2×RING_RADIUS.
    for (let ci = 0; ci < cells.length; ci++) {
      for (let cj = ci + 1; cj < cells.length; cj++) {
        const ca = cells[ci]
        const cb = cells[cj]
        const ca_center = ca.getCenter()
        const cb_center = cb.getCenter()
        const dx = cb_center.x - ca_center.x
        const dy = cb_center.y - ca_center.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
        if (dist < 200) {
          const nx = dx / dist
          const ny = dy / dist
          const springF = (200 - dist) * 0.2
          const va = ca.getCenterVelocity()
          const vb = cb.getCenterVelocity()
          const approachSpeed = (va.x - vb.x) * nx + (va.y - vb.y) * ny
          const dampF = approachSpeed * 0.5
          const f = springF + dampF
          const vc = ca.getVertexCount()
          for (let i = 0; i < vc; i++) {
            ca.applyExternalForce(i, -nx * f / vc, -ny * f / vc)
            cb.applyExternalForce(i,  nx * f / vc,  ny * f / vc)
          }
        }
      }
    }

    // Sticky mode: bond any pair of cells within touching range
    if (input.isFuseMode()) {
      for (let ci = 0; ci < cells.length; ci++) {
        for (let cj = ci + 1; cj < cells.length; cj++) {
          const ca = cells[ci].getCenter()
          const cb = cells[cj].getCenter()
          const dx = cb.x - ca.x, dy = cb.y - ca.y
          if (Math.sqrt(dx * dx + dy * dy) < 220) addBond(cells[ci], cells[cj])
        }
      }
    }

    // Draw bonds (purely visual — no physics forces from Connector)
    for (const { c, a, b } of bonds) c.update(a, b)
    for (const cell of cells) cell.update()

    // Organelles and nutrient pipeline — run after cells so positions are current.
    const furnaceCenter  = furnaceOwner.getCenter()
    // Cosmetic attach point: cell1 surface facing cell2 (pure visual, no Connector dependency)
    const _bc1 = cell1.getCenter(), _bc2 = cell2.getCenter()
    const _bdx = _bc2.x - _bc1.x,  _bdy = _bc2.y - _bc1.y
    const _bdl = Math.sqrt(_bdx * _bdx + _bdy * _bdy) || 1
    const attachPoint = { x: _bc1.x + (_bdx / _bdl) * 100, y: _bc1.y + (_bdy / _bdl) * 100 }

    furnace.update({ x: furnaceCenter.x, y: furnaceCenter.y - 20 }, furnaceOwner, nutrientPool)
    squareFactory.update({ x: furnaceCenter.x, y: furnaceCenter.y + 20 }, attachPoint)
    receptor.update(receptorOwner, nutrientPool)

    // Nutrient physics + respawn + draw — runs last so receptor ingestion is applied first.
    nutrientPool.update(cells)

    // Mouse in world space
    const mouseWorld = {
      x: mouse.screenX - worldContainer.x,
      y: mouse.screenY - worldContainer.y,
    }

    // Division preview
    const spaceReleased = input.wasSpaceReleased()
    divisionGraphics.clear()

    // Split flash — brief bright line at the division point, fades over ~20 frames
    if (flashFrames > 0 && flashAxis) {
      const t = flashFrames / 20   // 1.0 → 0.0 as it fades
      divisionGraphics.setStrokeStyle({ width: 2 + t * 2, color: 0xffffff, alpha: t * 0.9 })
      divisionGraphics.moveTo(flashAxis.cx + flashAxis.ax * -120, flashAxis.cy + flashAxis.ay * -120)
      divisionGraphics.lineTo(flashAxis.cx + flashAxis.ax *  120, flashAxis.cy + flashAxis.ay *  120)
      divisionGraphics.stroke()
      flashFrames--
    }

    if (input.isSpaceHeld()) {
      const hoveredCell = cells.find(c => c.isHovered()) ?? null
      if (hoveredCell) {
        divisionTarget = hoveredCell
        drawSplitPreview(divisionGraphics, hoveredCell, mouseWorld)
      } else {
        divisionTarget = null  // cancelled — mouse moved off cell
      }
    } else {
      if (spaceReleased && divisionTarget) {
        executeDiv(divisionTarget, mouseWorld)
      }
      divisionTarget = null
    }

    // Off-screen indicator: show arrow + distance when the cluster is out of view.
    const clusterPos = {
      x: (cell1.getCenter().x + cell2.getCenter().x) / 2,
      y: (cell1.getCenter().y + cell2.getCenter().y) / 2,
    }
    hud.update(clusterPos, cameraPos, app.screen.width, app.screen.height, {
      elapsedFrames,
      energy: cell1.energy,
      maxEnergy: cell1.maxEnergy,
      consumed: furnace.getConsumed(),
      fuseMode: input.isFuseMode(),
    })
  })
}
