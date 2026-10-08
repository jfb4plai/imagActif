import { createGenerationHandler } from './_lib/handlers/generation.js'
import { requireUser } from './_lib/auth.js'
import { createRepo } from './_lib/repo.js'

export default createGenerationHandler({ requireUser, repo: createRepo() })
