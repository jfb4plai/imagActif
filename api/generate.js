import { createGenerateHandler } from './_lib/handlers/generate.js'
import { requireUser } from './_lib/auth.js'
import { createRepo } from './_lib/repo.js'
import { bfl } from './_lib/providers/bfl.js'
import { dechiffrer, ringFromEnv } from './_lib/crypto.js'

export default createGenerateHandler({ requireUser, repo: createRepo(), bfl, dechiffrer, ring: ringFromEnv })
