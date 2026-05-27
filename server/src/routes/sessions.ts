import { idResourceRouter } from './factory.js'
import { storage } from '../db/storage.js'

export default idResourceRouter({
  path: '/sessions',
  list: () => storage.listSessions(),
  get: (id) => storage.getSession(id),
  put: (v) => storage.putSession(v as never),
  remove: (id) => storage.deleteSession(id),
  invalidMsg: 'Invalid session',
  deleteFailStatus: 404,
  deleteFailMsg: 'Not found',
})
