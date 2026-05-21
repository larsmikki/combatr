// Convert a 5etools-format bestiary JSON (e.g. bestiary-idrotf.json) into a
// Combatr Monster[] JSON file using the shared converter in
// client/src/lib/convert5eToolsBestiary.ts.
//
// PROPRIETARY CONTENT — input and output are gitignored. Run only against
// data the user has legally acquired; output goes through the private-import
// path (POST /api/monsters/bulk), never the bundled SRD .ts files.
//
// Run: npx tsx scripts/convert-rotf-bestiary.ts [input] [output]
// Defaults: ./bestiary-idrotf.json → ./monsters-rotf.json

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { convertBestiary } from '../client/src/lib/convert5eToolsBestiary'

const inputPath = resolve(process.argv[2] ?? 'bestiary-idrotf.json')
const outputPath = resolve(process.argv[3] ?? 'monsters-rotf.json')
const skippedPath = resolve(dirname(outputPath), basename(outputPath, '.json') + '-skipped.txt')

const parsed = JSON.parse(readFileSync(inputPath, 'utf-8'))
const { converted, skipped } = convertBestiary(parsed, {
  sourceName: 'Icewind Dale: Rime of the Frostmaiden',
  defaultTag: 'rotf',
})

writeFileSync(outputPath, JSON.stringify(converted, null, 2))
writeFileSync(
  skippedPath,
  `# Skipped entries (need _copy resolution against MM/ToA bestiaries)\n` +
  `# Total: ${skipped.length}\n\n` +
  skipped.map(s => `- ${s.name} [p${s.page ?? '?'}] — ${s.reason}`).join('\n') + '\n',
)

console.log(`Converted: ${converted.length}`)
console.log(`Skipped (need _copy resolution): ${skipped.length}`)
console.log(`→ ${outputPath}`)
console.log(`→ ${skippedPath}`)
