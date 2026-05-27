import { slugResourceRouter } from './factory.js'
import { storage } from '../db/storage.js'

export default slugResourceRouter({
  path: '/rules',
  list: () => storage.listCustomRuleElements(),
  get: (slug) => storage.getCustomRuleElement(slug),
  put: (v) => storage.putCustomRuleElement(v as never),
  remove: (slug) => storage.deleteCustomRuleElement(slug),
  wipe: () => storage.wipeCustomRuleElements(),
  putBulk: (list) => storage.putCustomRuleElementsBulk(list as never),
  invalidMsg: 'Invalid rule element (missing slug)',
  bulkKey: 'rules',
  bulkErrMsg: 'Expected an array of rules or { rules: [...] }',
})
