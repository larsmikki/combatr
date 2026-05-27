import { idResourceRouter } from './factory.js'
import { storage } from '../db/storage.js'

export default idResourceRouter({
  path: '/campaigns',
  list: () => storage.listCampaigns(),
  get: (id) => storage.getCampaign(id),
  put: (v) => storage.putCampaign(v as never),
  remove: (id) => storage.deleteCampaign(id),
  invalidMsg: 'Invalid campaign',
  deleteFailStatus: 400,
  deleteFailMsg: 'Cannot delete (not found, or last campaign)',
})
