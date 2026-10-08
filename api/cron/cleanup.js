import { createCleanupHandler } from '../_lib/handlers/cleanup.js'
import { createRepo } from '../_lib/repo.js'

export default createCleanupHandler({ repo: createRepo(), secret: process.env.CRON_SECRET })
