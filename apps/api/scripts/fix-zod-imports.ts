/**
 * Post-generation script: adds .js to the single relative import in
 * src/generated/zod/schemas.ts (required for NodeNext module resolution).
 *
 * Usage: tsx scripts/fix-zod-imports.ts
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const FILE = join(import.meta.dirname, '..', 'src', 'generated', 'zod', 'schemas.ts')

const content = await readFile(FILE, 'utf-8')
const updated = content.replace(
  /(from\s+['"])(\.[^'"]+)(?<!\.js)(['"])/g,
  '$1$2.js$3',
)

if (updated !== content) {
  await writeFile(FILE, updated)
  console.log('Fixed .js extensions in schemas.ts')
} else {
  console.log('No fixes needed')
}
