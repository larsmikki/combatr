import { idResourceRouter } from './factory.js'
import { storage } from '../db/storage.js'

export default idResourceRouter({
  path: '/characters',
  list: () => storage.listCharacters(),
  get: (id) => storage.getCharacter(id),
  put: (v) => storage.putCharacter(v as never),
  remove: (id) => storage.deleteCharacter(id),
  invalidMsg: 'Invalid character',
  deleteFailStatus: 404,
  deleteFailMsg: 'Not found',
})
