import { Router } from 'express'
import state from './state.js'
import campaigns from './campaigns.js'
import encounters from './encounters.js'
import sessions from './sessions.js'
import characters from './characters.js'
import monsters from './monsters.js'
import spells from './spells.js'
import rules from './rules.js'
import proxy from './proxy.js'

const router = Router()

router.use(state)
router.use(campaigns)
router.use(encounters)
router.use(sessions)
router.use(characters)
router.use(monsters)
router.use(spells)
router.use(rules)
router.use(proxy)

export default router
