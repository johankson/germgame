import { Application } from 'pixi.js'
import { createGame } from './game'

;(async () => {
  const app = new Application()
  await app.init({
    width: 800,
    height: 600,
    backgroundColor: 0x0a1628,
  })

  document.getElementById('app')!.appendChild(app.canvas)
  createGame(app)
})()
