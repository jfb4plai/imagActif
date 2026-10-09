import { createRetoucheHandler } from './_lib/handlers/retoucher.js'
import { requireUser } from './_lib/auth.js'
import { createRepo } from './_lib/repo.js'
import { bfl } from './_lib/providers/bfl.js'
import { dechiffrer, ringFromEnv } from './_lib/crypto.js'

export default createRetoucheHandler({ requireUser, repo: createRepo(), bfl, dechiffrer, ring: ringFromEnv })
