/**
 * Cache the results of {@link tarball}.
 *
 * ```js
 * // Clear the cache.
 * tarball_cache.clear()
 * ```
 */
export const tarball_cache = new Map<string, Promise<Uint8Array>>()

export interface TarballOptions {
  /**
   * A function that returns cached tarball.
   *
   * ```js
   * // possible implementation
   * const cache_get = ({ name, version }) => localStorage.getItem(`${name}@${version}`)
   * ```
   */
  cache_get?: (pkg: {
    name: string
    version: string
  }) => Promise<Uint8Array | null | undefined> | Uint8Array | null | undefined

  /**
   * A function that saves the tarball to cache.
   *
   * ```js
   * // possible implementation
   * const cache_set = ({ name, version }, tarball) => localStorage.setItem(`${name}@${version}`, tarball)
   * ```
   */
  cache_set?: (pkg: { name: string; version: string }, tarball: Uint8Array) => Promise<void> | void

  /**
   * An {@link AbortSignal} object instance to abort the request.
   */
  signal?: AbortSignal

  /**
   * The registry URL to fetch the tarball, default is `'https://registry.npmjs.org'`.
   */
  registry?: string
}

/**
 * Fetches the registry tarball of a package.
 *
 * It may throws an error if the fetch returns a non-200 status code.
 *
 * ```js
 * let controller = new AbortController()
 * let signal = controller.signal
 * let uint8array = await tarball({ name: 'vite', version: '4.2.1' }, { signal })
 * ```
 */
export async function tarball(pkg: { name: string; version: string }, opts: TarballOptions = {}) {
  let url = `https://registry.npmjs.org/${pkg.name}/-/${pkg.name.split('/').pop()}-${pkg.version}.tgz`
  if (opts.registry) {
    let registry = opts.registry
    if (!registry.includes('://')) registry = `https://${registry}`
    if (registry.endsWith('/')) registry = registry.slice(0, -1)
    url = url.replace('https://registry.npmjs.org', registry)
  }
  if (tarball_cache.has(url)) {
    return tarball_cache.get(url)!
  }

  if (opts.cache_get) {
    const data = await opts.cache_get(pkg)
    if (data) {
      tarball_cache.set(url, Promise.resolve(data))
      return data
    }
  }

  const promise = fetch(url, opts)
    .then(async (r) => {
      if (r.ok) return r.arrayBuffer()
      else throw new Error(await r.text())
    })
    .then((buffer) => {
      const data = new Uint8Array(buffer)
      if (opts.cache_set) {
        opts.cache_set(pkg, data)
      }
      return data
    })

  tarball_cache.set(url, promise)
  return promise
}
