// Min Heap
export class Heap {
  public size = 0
  public data: number[] = new Array(128)

  get() {
    return this.data.slice(0, this.size)
  }

  add(value: number) {
    if (this.size < 127) {
      this.data[this.size++] = value
      this._up(this.size - 1)
    }
    // heap is full, do pushpop
    else {
      this.data[this.size] = value
      this._up(this.size)
      this.data[0] = this.data[this.size]
      this._down(0)
    }
  }

  _up(index: number) {
    let parent = (index - 1) >> 1
    while (index > 0 && this.data[parent] > this.data[index]) {
      const temp = this.data[index]
      this.data[index] = this.data[parent]
      this.data[parent] = temp

      index = parent
      parent = (index - 1) >> 1
    }
  }

  _down(index: number) {
    while (index < this.size >> 1) {
      const left = (index << 1) | 1
      const right = left + 1

      const a = this.data[index]
      const la = this.data[left]
      const ra = this.data[right]

      if (a < la && a < ra) break

      const j = la < ra ? left : right
      this.data[index] = this.data[j]
      this.data[j] = a

      index = j
    }
  }
}
