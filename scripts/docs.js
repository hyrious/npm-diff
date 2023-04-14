import fs from 'node:fs/promises'
import { build, context } from 'esbuild'

await fs.rm('./site/dist', { recursive: true, force: true })

const watch = process.argv.slice(2).includes('-w')

if (watch) {
  const ctx = await context({
    entryPoints: ['./site/src/main.ts'],
    bundle: true,
    outfile: './site/dist/main.js',
    define: { __DEV__: 'true' },
    plugins: [patch_diff()],
    write: false,
  })
  await ctx.watch()
  const { host, port } = await ctx.serve({ port: 3000, servedir: './site' })
  const hostname = ['127.0.0.1', '0.0.0.0'].includes(host) ? 'localhost' : host
  console.log(`http://${hostname}:${port}`)
} else {
  await build({
    entryPoints: ['./site/src/main.ts'],
    bundle: true,
    outfile: './site/dist/main.js',
    define: { __DEV__: 'false' },
    target: ['chrome51'],
    logLevel: 'info',
    minify: true,
    sourcemap: true,
    plugins: [patch_diff()],
  }).catch(() => process.exit(1))
}

// Patch the 'diff' package to add timeout to sync diffing
function patch_diff() {
  return {
    name: 'patch(diff)',
    setup({ onLoad }) {
      onLoad({ filter: /\bnode_modules\/diff\b/ }, async (args) => {
        let code = await fs.readFile(args.path, 'utf8')

        // 1. prepend 'var deadline = 1 seconds later' before execEditLength()
        let i = code.indexOf('function execEditLength() {')
        if (i === -1) throw new Error('not found execEditLength()')
        i = code.lastIndexOf('\n', i) + 1
        code = code.slice(0, i) + '    var deadline = Date.now() + 1000\n' + code.slice(i)

        // 2. prepend 'if (Date.now() > deadline) return give_up' inside execEditLength()
        i = code.indexOf('function execEditLength() {')
        i = code.indexOf('\n', i) + 1
        // prettier-ignore
        code = code.slice(0, i) + ('      if (Date.now() > deadline) return ['
          + '{value: self.join(oldString), count: oldString.length, added: false, removed: true},'
          + '{value: self.join(newString), count: newString.length, added: true, removed: false}' 
          + ']\n') + code.slice(i)

        return { contents: code, loader: 'default' }
      })
    },
  }
}
