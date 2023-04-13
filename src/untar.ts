import { inflate } from '../lib/unzip.js'

export const normalize = (path: string) => path.replace(/\\+/g, '/').replace(/^\.\/|^\./, '')

export interface UntarResponse {
  files: Set<string>
  refs: Map<string, { content: string; mode: string }>
}

export interface UntarOptions {
  item: Uint8Array
  prefix: string
  filterFiles: string[]
}

/**
 * Untar a tarball and mutate the `files` and `refs`.
 */
export async function untar({ files, refs }: UntarResponse, { item, prefix, filterFiles }: UntarOptions) {
  filterFiles = filterFiles.map(normalize)

  // might be gzipped
  if (item[0] === 0x1f && item[1] === 0x8b) {
    item = await inflate(item)
  }

  const length = item.byteLength
  const view = new DataView(item.buffer)

  let globalPaxHeader: { path?: string; size?: number } | undefined
  let localPaxHeader: { path?: string; size?: number } | undefined
  for (let offset = 0; offset + 4 < length && view.getUint32(offset, true) !== 0; ) {
    let name: string
    let content = ''
    let size: number

    name = read_string(view, offset, 100)
    const mode = Number.parseInt(read_string(view, offset + 100, 8), 8)
    size = Number.parseInt(read_string(view, offset + 124, 12), 8)
    const type = read_string(view, offset + 156, 1)

    const ustar = read_string(view, offset + 257, 6)
    if (ustar.includes('ustar')) {
      const prefix = read_string(view, offset + 345, 155)
      if (prefix.length > 0) name = prefix + '/' + name
    }

    offset += 512
    if (type === '0' || type === '') {
      content = read_string(view, offset, size)
    } else if (type === 'g') {
      globalPaxHeader = read_pax(view, offset, size)
    } else if (type === 'x') {
      localPaxHeader = read_pax(view, offset, size)
    }
    offset += Math.ceil(size / 512) * 512

    if (type === 'g' || type === 'x') {
      continue
    }

    if (globalPaxHeader) {
      if (globalPaxHeader.path) name = globalPaxHeader.path
      if (globalPaxHeader.size) size = globalPaxHeader.size
    }

    if (localPaxHeader) {
      if (localPaxHeader.path) name = localPaxHeader.path
      if (localPaxHeader.size) size = localPaxHeader.size
      localPaxHeader = undefined
    }

    if (type === '0' || type === '') {
      name = normalize(name)

      if (
        !filterFiles.length ||
        filterFiles.includes(name) ||
        filterFiles.includes('package/' + name) ||
        filterFiles.some((f) => f.startsWith(name) || f.startsWith('package/' + name))
      ) {
        const key = name.replace(/^[^/]+\/?/, '')
        files.add(key)

        refs.set(prefix + key, { content, mode: '100' + mode.toString(8) })
      }
    }
  }
}

const decoder = /* @__PURE__ */ new TextDecoder()

/**
 * Read and decode an UTF-8 string from a DataView.
 *
 * This function should not create any copy of the memory.
 *
 * ```js
 * read_string(view, offset, 100) // => 'hello'
 * ```
 */
function read_string(view: DataView, offset: number, length: number) {
  const temp = new Uint8Array(view.buffer, offset, length)
  const i = temp.indexOf(0)
  return decoder.decode(temp.subarray(0, i === -1 ? length : i))
}

/**
 * Parse extended headers, it is formed as:
 *
 * ```js
 * "%d %s=%s\n".format(length, key, value)
 * ```
 */
function read_pax(view: DataView, offset: number, length: number) {
  const re = /^(\d+) ([^=]+)=(.*)$/gm
  const raw = read_string(view, offset, length)
  const result: { path?: string; size?: number } = { path: undefined, size: undefined }
  for (let match: RegExpExecArray | null; (match = re.exec(raw)); ) {
    const [, _len, key, value] = match
    if (key === 'path') result.path = value
    if (key === 'size') result.size = Number.parseInt(value)
  }
  return result
}

export interface ReadTarballOptions {
  /** Only read these files */
  diffFiles?: string[]
}

/**
 * Read tarballs and return all the files.
 *
 * ```js
 * await readTarballs([{ item: uint8array, prefix: '' }])
 * // => { files: Set { 'a' }, refs: Map { 'a' => { content: '...', mode: '...' } } }
 * ```
 */
export async function readTarballs(
  tarballs: Array<{ item: Uint8Array; prefix: string }>,
  opts: ReadTarballOptions = {},
) {
  const files = new Set<string>()
  const refs = new Map<string, { content: string; mode: string }>()

  const filterFiles = opts.diffFiles || []

  for (const i of tarballs) {
    await untar({ files, refs }, { item: i.item, prefix: i.prefix, filterFiles })
  }

  return { files, refs }
}
