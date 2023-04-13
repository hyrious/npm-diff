# @hyrious/npm-diff

> [libnpmdiff](https://www.npmjs.com/package/libnpmdiff), but detects renames and works on browser

## Usage

### CLI

Use [**`npm diff`**](https://docs.npmjs.com/cli/v9/commands/npm-diff) please.

### API

In Node.js or with bundlers:

```js
import { diff } from '@hyrious/npm-diff'

console.log(await diff(['abbrev@1.1.0', 'abbrev@1.1.1']))
```

In browser:

```html
<script src="https://cdn.jsdelivr.net/npm/pako"></script>
<script src="https://cdn.jsdelivr.net/npm/diff"></script>
<script src="https://cdn.jsdelivr.net/npm/@hyrious/npm-diff"></script>
<script>
  const { diff } = npmdiff
  console.log(await diff(...))
</script>
```

Or:

```html
<script type="module">
  import { diff } from 'https://esm.sh/@hyrious/npm-diff'
  console.log(await diff(...))
</script>
```

#### diff([ a, b ], opts?) &rarr; Promise&lt;String&gt;

Fetches the registry tarballs and compare files between a spec `a` and spec `b`.
The spec is usually described in `<pkg-name>@<version>`.

##### Options

- `tagVersionPrefix` {String} Prefix used to define version numbers. Defaults to `v`.
- `diffUnified` {Number} How many lines to print around each hunk. Defaults to `3`.
- `diffIgnoreAllSpace` {Boolean} Whether or not should ignore changes in whitespace (very useful to avoid indentation changes extra diff lines). Defaults to `false`.
- `diffFiles` {Array&lt;String&gt;} If set only prints patches for the files listed in this array (also accepts globs). Defaults to `undefined`.
- `diffNameOnly` {Boolean} Prints only file names and no patch diffs. Defaults to `false`.
- `diffNoPrefix` {Boolean} If true then skips printing any prefixes in filenames. Defaults to `false`.
- `diffSrcPrefix` {String} Prefix to be used in the filenames from `a`. Defaults to `a/`.
- `diffDstPrefix` {String} Prefix to be used in the filenames from `b`. Defaults to `b/`.
- `diffText` {Boolean} Should treat all files as text and try to print diff for binary files. Defaults to `false`.
- `cache_get` {Function} User-defined cache getter before fetching tarballs, it takes an object `{ name, version }` and returns a `Promise` that fullfils with a `Uint8Array` containing the tarball. Defaults to `undefined`, which means each tarball will be fetched without cache.
- `cache_set` {Function} User-defined cache setter after fetching tarballs, it takes an object `{ name, version }` and a `Uint8Array` which is the tarball content. Defaults to `undefined`.
- `signal` {AbortSignal} Abort signal to cancel all the progress. Defaults to `undefined`.

Returns a `Promise` that fullfils with a `String` containing the resulting patch diffs.

Throws an error if either `a` or `b` are missing or if trying to diff more than two specs.

##### More Examples

**Store packages in indexedDB**, see **[idb-keyval](https://www.npmjs.com/package/idb-keyval)**

```js
import * as idb from 'idb-keyval'

const patch = await diff(['abbrev@1.1.0', 'abbrev@1.1.1'], {
  cache_get: ({ name, version }) => idb.get(`${name}@${version}`),
  cache_set: ({ name, version }, tarball) => idb.set(`${name}@${version}`, tarball),
})
```

**Render patch to html**, see **[diff2html](https://www.npmjs.com/package/diff2html)**

```js
const patch = await diff(['abbrev@1.1.0', 'abbrev@1.1.1'])
const ui = new Diff2HtmlUI($('#diff'), patch, {
  drawFileList: true,
  outputFormat: 'line-by-line',
})
ui.draw()
ui.highlightCode()
```

## License

MIT © [hyrious](https://github.com/hyrious)
