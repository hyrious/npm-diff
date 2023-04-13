import binaryExtensions from 'binary-extensions'
import { createTwoFilesPatch } from 'diff'
import { Heap } from './heap'

/**
 * FNV hash taken from {@link http://www.isthe.com/chongo/tech/comp/fnv/index.html#FNV-param}
 */
function hash_line(line: string): number {
  let hash = 2166136261
  for (let i = 0; i < 80 && i < line.length; i++) {
    hash ^= line.charCodeAt(i)
    hash = (hash * 16777619) >>> 0
  }
  return hash
}

/**
 * Compute a hash of each lines of given text, sort by value.
 */
function hash(text: string): number[] {
  const lines = text.split(/\r\n|\r|\n/g)
  const heap = new Heap()
  for (let line of lines) {
    if ((line = line.trim())) {
      heap.add(hash_line(line))
    }
  }
  return heap.get().sort((a, b) => a - b)
}

/**
 * Compute the similarity between two hashes.
 */
function match(a: number[], b: number[]) {
  let count = 0
  for (let i = 0, len = a.length; i < len; ++i) {
    if (a[i] === b[i]) count++
  }
  return (100 * count * 2) / (a.length + b.length)
}

/**
 * Find similar files between `a` and `b`.
 *
 * Identical files will be skipped.
 */
function match_similar_files(files: Set<string>, refs: Map<string, { content: string; mode: string }>) {
  const pairs: [a: string | null, b: string | null][] = []

  // Unique files found in a or b. Later we will try to match them.
  const a_uniq: [filename: string, hash: number[]][] = []
  const b_uniq: [filename: string, hash: number[]][] = []
  for (const filename of files) {
    const a = refs.get('a/' + filename)
    const b = refs.get('b/' + filename)
    if (a && b && a.content === b.content && a.mode === b.mode) continue
    if (a && b) {
      pairs.push([filename, filename])
    } else if (a) {
      a_uniq.push([filename, hash(a.content)])
    } else if (b) {
      b_uniq.push([filename, hash(b.content)])
    }
  }

  // Try to match similar files in a and b.
  const scores: [i: number, j: number, score: number][] = []
  for (let i = 0; i < a_uniq.length; i++) {
    for (let j = 0; j < b_uniq.length; j++) {
      const score = match(a_uniq[i][1], b_uniq[j][1])
      scores.push([i, j, score])
    }
  }
  scores.sort((a, b) => b[2] - a[2])
  for (const [i, j, score] of scores) {
    if (a_uniq[i][0] === '' || b_uniq[j][0] === '') continue
    if (score < 0.5) break
    pairs.push([a_uniq[i][0], b_uniq[j][0]])
    a_uniq[i][0] = ''
    b_uniq[j][0] = ''
  }

  for (let i = 0; i < a_uniq.length; ++i) {
    if (a_uniq[i][0] !== '') {
      pairs.push([a_uniq[i][0], null])
    }
  }

  for (let j = 0; j < b_uniq.length; ++j) {
    if (b_uniq[j][0] !== '') {
      pairs.push([null, b_uniq[j][0]])
    }
  }

  return pairs
}

function should_print_patch(path: string, opts: { diffText?: boolean } = {}) {
  if (opts.diffText) {
    return true
  }

  const extension = path.split('.').pop()!

  return !binaryExtensions.includes(extension)
}

export interface FormatOptions {
  /** Should treat all files as text and try to print diff for binary files. Defaults to `false`. */
  diffText?: boolean
  /** If true then skips printing any prefixes in filenames. Defaults to `false`. */
  diffNoPrefix?: boolean
  /** Prefix to be used in the filenames from `a`. Defaults to `a/`. */
  diffSrcPrefix?: string
  /** Prefix to be used in the filenames from `b`. Defaults to `b/`. */
  diffDstPrefix?: string
  /** Prints only file names and no patch diffs. Defaults to`false`. */
  diffNameOnly?: boolean
  /** Prefix used to define version numbers. Defaults to `v`. */
  tagVersionPrefix?: string
  /** How many lines to print around each hunk. Defaults to `3`. */
  diffUnified?: number
  /** Whether or not should ignore changes in whitespace. Defaults to `false` */
  diffIgnoreAllSpace?: boolean
}

export interface FormatArgs {
  files: Set<string>
  opts: FormatOptions
  refs: Map<string, { content: string; mode: string }>
  versions: { a: string; b: string }
}

/**
 * Return diff patches on `files`.
 */
export function format_diff({ files, opts = {}, refs, versions }: FormatArgs): string {
  const EOL = '\n'

  let res = ''
  const src_prefix = opts.diffNoPrefix ? '' : opts.diffSrcPrefix || 'a/'
  const dst_prefix = opts.diffNoPrefix ? '' : opts.diffDstPrefix || 'b/'

  const entries = match_similar_files(files, refs)
  for (const [a_filename, b_filename] of entries) {
    const names = {
      a: src_prefix + (a_filename || '/dev/null'),
      b: dst_prefix + (b_filename || '/dev/null'),
    }

    let mode = ''
    const data = {
      a: a_filename && refs.get('a/' + a_filename),
      b: b_filename && refs.get('b/' + b_filename),
    }
    const contents = {
      a: data.a && data.a.content,
      b: data.b && data.b.content,
    }
    const modes = {
      a: data.a && data.a.mode,
      b: data.b && data.b.mode,
    }

    if (opts.diffNameOnly) {
      res += (a_filename || b_filename) + EOL
      continue
    }

    let patch = ''
    const header = (str: string) => {
      patch += str + EOL
    }

    header(`diff --git ${names.a} ${names.b}`)
    if (a_filename && b_filename && a_filename !== b_filename) {
      // This is incorrect... ideally, it should be (total_lines - diff_lines) / total_lines
      // but there's no time for us to compute the diff, and in most of the cases it is 99%
      // so let's just use that.
      header('similarity index 99%')
      header(`rename from ${names.a}`)
      header(`rename to ${names.b}`)
    }
    if (modes.a && modes.a === modes.b) {
      mode = modes.a
    } else {
      if (modes.a && !modes.b) {
        header(`deleted file mode ${modes.a}`)
      } else if (!modes.a && modes.b) {
        header(`new file mode ${modes.b}`)
      } else {
        header(`old mode ${modes.a}`)
        header(`new mode ${modes.b}`)
      }
    }
    // prettier-ignore
    header(`index ${opts.tagVersionPrefix || 'v'}${versions.a}..${opts.tagVersionPrefix || 'v'}${versions.b} ${mode}`)

    if (should_print_patch((a_filename || b_filename)!, opts)) {
      patch += createTwoFilesPatch(names.a, names.b, contents.a || '', contents.b || '', '', '', {
        context: opts.diffUnified === 0 ? 0 : opts.diffUnified || 3,
        ignoreWhitespace: opts.diffIgnoreAllSpace,
      })
        .replace('===================================================================\n', '')
        .replace(/\t\n/g, '\n')
    } else {
      header(`--- ${names.a}`)
      header(`+++ ${names.b}`)
    }

    res += patch
  }

  return res.trim()
}
