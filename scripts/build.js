import fs from 'node:fs/promises'
import * as dts from '@hyrious/dts'
import * as esbuild from 'esbuild'

await fs.rm('dist', { recursive: true, force: true })

const build_dts = dts.build('src/index.ts', 'dist/index.d.ts')

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/index.js',
  external: ['./lib/*', 'pako', 'diff', 'binary-extensions'],
})

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'npmdiff',
  outfile: 'dist/index.global.js',
  plugins: [globals({ diff: 'Diff' }), replace_pako()],
})

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'iife',
  minify: true,
  globalName: 'npmdiff',
  outfile: 'dist/index.global.prod.js',
  plugins: [globals({ diff: 'Diff' }), replace_pako()],
})

const { elapsed, output } = await build_dts
console.log('Built', output[0].fileName, 'in', elapsed + 'ms')

function globals(config) {
  return {
    name: 'globals',
    setup({ onResolve, onLoad }) {
      onResolve({ filter: new RegExp('^(' + Object.keys(config).join('|') + ')$') }, (args) => {
        return { path: args.path, namespace: 'globals' }
      })
      onLoad({ filter: /./, namespace: 'globals' }, (args) => {
        const globalName = config[args.path]
        return { contents: `module.exports = ${globalName}` }
      })
    },
  }
}

function replace_pako() {
  return {
    name: 'replace-pako',
    setup({ onLoad }) {
      onLoad({ filter: /\bunzip-browser\b/ }, async (args) => {
        let code = await fs.readFile(args.path, 'utf8')
        code = code.replace("import('pako').then((pako) => pako.inflate(data))", 'pako.inflate(data)')
        return { contents: code, loader: 'default' }
      })
    },
  }
}
