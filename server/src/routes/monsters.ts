import { slugResourceRouter } from './factory.js'
import { storage } from '../db/storage.js'

export default slugResourceRouter({
  path: '/monsters',
  list: () => storage.listCustomMonsters(),
  get: (slug) => storage.getCustomMonster(slug),
  put: (v) => storage.putCustomMonster(v as never),
  remove: (slug) => storage.deleteCustomMonster(slug),
  wipe: () => storage.wipeCustomMonsters(),
  putBulk: (list) => storage.putCustomMonstersBulk(list as never),
  invalidMsg: 'Invalid monster (missing slug)',
  bulkKey: 'monsters',
  bulkErrMsg: 'Expected an array of monsters or { monsters: [...] }',
})
