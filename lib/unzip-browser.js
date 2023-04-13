/**
 * Unzip a Uint8Array using the browser's native DecompressionStream API if available, otherwise
 * fallback to pako.
 *
 * @param {Uint8Array} data
 * @returns {Promise<Uint8Array>}
 */
export function inflate(data) {
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip')
    const writer = ds.writable.getWriter()
    writer.write(data)
    writer.close()
    return new Response(ds.readable).arrayBuffer().then((buffer) => new Uint8Array(buffer))
  } else {
    return import('pako').then((pako) => pako.inflate(data))
  }
}
