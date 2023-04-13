import { FormatOptions, format_diff } from './format-diff'
import { ResolveOptions, resolve } from './resolve'
import { TarballOptions, tarball } from './tarball'
import { ReadTarballOptions, readTarballs } from './untar'

const argsError = () =>
  Object.assign(new TypeError('@hyrious/npm-diff needs two arguments to compare'), {
    code: 'EDIFFARGS',
  })

export type DiffOptions = ResolveOptions & TarballOptions & ReadTarballOptions & FormatOptions

/**
 * Fetches the registry tarballs and compare files between a spec `a` and spec `b`.
 *
 * Returns a promise of string that contains the resulting patch diffs.
 */
export async function diff(specs: [a: string, b: string], opts: DiffOptions = {}): Promise<string> {
  if (specs.length !== 2) {
    throw argsError()
  }

  const [a_meta, b_meta] = await Promise.all(specs.map((spec) => resolve(spec, opts)))

  const versions = { a: a_meta.version, b: b_meta.version }

  const [a, b] = await Promise.all([tarball(a_meta, opts), tarball(b_meta, opts)])

  const { files, refs } = await readTarballs(
    [
      { prefix: 'a/', item: a },
      { prefix: 'b/', item: b },
    ],
    opts,
  )

  return format_diff({ files, opts, refs, versions })
}
