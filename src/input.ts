export class Input {
  readonly keys = { up: false, down: false, left: false, right: false }

  constructor() {
    window.addEventListener('keydown', e => this.setKey(e.key, true))
    window.addEventListener('keyup', e => this.setKey(e.key, false))
  }

  direction(): { x: number; y: number } {
    let x = 0
    let y = 0
    if (this.keys.left) x -= 1
    if (this.keys.right) x += 1
    if (this.keys.up) y -= 1
    if (this.keys.down) y += 1

    if (x !== 0 && y !== 0) {
      const len = Math.sqrt(x * x + y * y)
      x /= len
      y /= len
    }

    return { x, y }
  }

  private setKey(key: string, val: boolean) {
    switch (key) {
      case 'ArrowUp': this.keys.up = val; break
      case 'ArrowDown': this.keys.down = val; break
      case 'ArrowLeft': this.keys.left = val; break
      case 'ArrowRight': this.keys.right = val; break
    }
  }
}
