import { createKeyHandler } from './_lib/handlers/key.js'
import { requireUser } from './_lib/auth.js'
import { createRepo } from './_lib/repo.js'
import { chiffrer, ringFromEnv } from './_lib/crypto.js'

export default createKeyHandler({ requireUser, repo: createRepo(), chiffrer, ring: ringFromEnv })
