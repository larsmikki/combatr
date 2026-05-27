import { slugResourceRouter } from './factory.js'
import { storage } from '../db/storage.js'

export default slugResourceRouter({
  path: '/spells',
  list: () => storage.listCustomSpells(),
  get: (slug) => storage.getCustomSpell(slug),
  put: (v) => storage.putCustomSpell(v as never),
  remove: (slug) => storage.deleteCustomSpell(slug),
  wipe: () => storage.wipeCustomSpells(),
  putBulk: (list) => storage.putCustomSpellsBulk(list as never),
  invalidMsg: 'Invalid spell (missing slug)',
  bulkKey: 'spells',
  bulkErrMsg: 'Expected an array of spells or { spells: [...] }',
})
