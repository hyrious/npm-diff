/**
 * Cache the results of {@link follow_redirects}.
 *
 * ```js
 * // Clear the cache.
 * fetch_cache.clear()
 * ```
 */
export const fetch_cache = new Map<string, Promise<string>>()

/**
 * Follow any redirects and return the final URL.
 *
 * It may throws an error if the fetch returns a non-200 status code.
 *
 * ```js
 * await follow_redirects('https://unpkg.com/vite@4/package.json')
 * // => 'https://unpkg.com/vite@4.2.1/package.json'
 * ```
 */
export async function follow_redirects(url: string, init?: RequestInit): Promise<string> {
  if (fetch_cache.has(url)) {
    return fetch_cache.get(url)!
  }

  const promise = fetch(url, init)
    .then(async (r) => {
      if (r.ok) return r.url
      else throw new Error(await r.text())
    })
    .catch((err) => {
      fetch_cache.delete(url)
      throw err
    })

  fetch_cache.set(url, promise)
  return promise
}

/**
 * Extract from the semver package.
 *
 * ```js
 * const is_valid = semver_loose.test('1.2.3')
 * ```
 */
export const semver_loose =
  /^[\s=v]*(\d+)\.(\d+)\.(\d+)(?:-?((?:\d+|\d*[A-Za-z-][\dA-Za-z-]*)(?:\.(?:\d+|\d*[A-Za-z-][\dA-Za-z-]*))*))?(?:\+([\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*))?$/

/**
 * Test if a version string is valid.
 *
 * It works the same as `semver.valid()`, see {@link semver_loose}.
 *
 * ```js
 * const is_valid = valid('1.2.3')
 * ```
 */
export function valid(version: string) {
  return semver_loose.test(version)
}

export interface ResolveOptions {
  signal?: AbortSignal
}

/**
 * Resolve a spec string like 'vite@4' to name and version.
 *
 * It uses {@link https://unpkg.com UNPKG} under the hood.
 *
 * ```js
 * await resolve('vite@4') // => { name: 'vite', version: '4.2.1' }
 * ```
 */
export async function resolve(
  spec: string,
  opts: ResolveOptions = {},
): Promise<{ name: string; version: string }> {
  let name: string
  const at = spec.indexOf('@', 1)
  if (at > 0) {
    name = spec.slice(0, at)
    spec = spec.slice(at + 1)
  } else {
    name = spec
    spec = '*'
  }
  if (!valid(spec)) {
    spec = await follow_redirects(`https://unpkg.com/${name}@${spec}/package.json`, opts)
    spec = spec.slice(18 + name.length + 1)
    spec = spec.slice(0, spec.indexOf('/'))
  }
  return { name, version: spec }
}
