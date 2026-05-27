import { idResourceRouter } from './factory.js'
import { storage } from '../db/storage.js'

export default idResourceRouter({
  path: '/encounters',
  list: () => storage.listEncounters(),
  get: (id) => storage.getEncounter(id),
  put: (v) => storage.putEncounter(v as never),
  remove: (id) => storage.deleteEncounter(id),
  invalidMsg: 'Invalid encounter',
  deleteFailStatus: 404,
  deleteFailMsg: 'Not found',
})
