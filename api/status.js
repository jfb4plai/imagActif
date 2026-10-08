import { createStatusHandler } from './_lib/handlers/status.js'
import { requireUser } from './_lib/auth.js'
import { createRepo } from './_lib/repo.js'
import { bfl } from './_lib/providers/bfl.js'
import { dechiffrer, ringFromEnv } from './_lib/crypto.js'

export default createStatusHandler({ requireUser, repo: createRepo(), bfl, dechiffrer, ring: ringFromEnv })
