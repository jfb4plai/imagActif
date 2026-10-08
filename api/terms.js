import { createTermsHandler } from './_lib/handlers/terms.js'
import { requireUser } from './_lib/auth.js'
import { createRepo } from './_lib/repo.js'

export default createTermsHandler({ requireUser, repo: createRepo() })
