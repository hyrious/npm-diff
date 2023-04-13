import zlib from 'zlib'

export function inflate(data) {
  return new Promise((resolve, reject) => {
    zlib.unzip(data, (error, result) => {
      if (error) reject(error)
      else resolve(new Uint8Array(result.buffer))
    })
  })
}
