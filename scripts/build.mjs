/**
 * Build the produce-preview plugin:
 *  - lib/index.js  : the host half (Node ESM) mounted by the Loader.
 *  - lib/client.js : the browser half, wrapped as the client-modules "closure
 *                    factory" the DSH Web runtime serves at /plugins/<id>/client.js.
 *  - lib/types/**   : TypeScript declarations (tsc, emitDeclarationOnly).
 *
 * The client bundle's byte format MUST match what client-modules expects:
 *   banner  window.__ModuleLoader__.load({ id, factory: (require) => {
 *   intro   var module = { exports: {} }; var exports = module.exports;
 *   footer  return module.exports; } });
 * with every cross-package dependency kept as a bare `require('...')` that the
 * module table resolves. Reproducing the stock tsdown clientBundle preset is
 * deliberately done inline so this package stays independent of the monorepo.
 */

import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { readFile, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const PKG_ID = pkg.name

// Module-table words the browser module system resolves. Type-only cross-
// package imports are erased by esbuild, so only runtime words appear here.
const BASELINE_EXTERNALS = [
  'react', 'react-dom', 'react/jsx-runtime', 'react-dom/client',
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives',
]
// Additional requests declared in dsh.client.external that our code may type-import.
const EXTRA_EXTERNALS = [
  '@deepseek-ai/dsh-client-ui-chat/client',
  '@deepseek-ai/dsh-client-ui-conversation/client',
]

async function main() {
  await rm(join(root, 'lib'), { recursive: true, force: true })
  await mkdir(join(root, 'lib'), { recursive: true })

  // Host half: leave external imports literal so the Loader resolves them from
  // the profile's installed dependencies. No JSX here.
  await build({
    entryPoints: [join(root, 'src/index.ts')],
    outfile: join(root, 'lib/index.js'),
    bundle: false,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    sourcemap: true,
    tsconfig: join(root, 'tsconfig.json'),
  })

  // Browser half: bundled, closure-factory wrapped, externals kept as require().
  await build({
    entryPoints: [join(root, 'src/client/index.ts')],
    outfile: join(root, 'lib/client.js'),
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2020',
    sourcemap: true,
    jsx: 'automatic',
    jsxImportSource: 'react',
    external: [...BASELINE_EXTERNALS, ...EXTRA_EXTERNALS],
    tsconfig: join(root, 'tsconfig.json'),
    banner: {
      js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PKG_ID)}, factory: (require) => {`
        + `\nvar module = { exports: {} }; var exports = module.exports;`,
    },
    footer: { js: 'return module.exports; } });' },
  })

  // Declarations for authoring consumers (runtime does not need them).
  try {
    execFileSync('npx', ['tsc', '--emitDeclarationOnly', '--project', join(root, 'tsconfig.json')], {
      cwd: root,
      stdio: 'inherit',
    })
  } catch {
    console.warn('tsc declaration emit skipped (typescript not installed); runtime bundle is complete')
  }

  console.log('built lib/index.js and lib/client.js for', PKG_ID)
}

await main()
