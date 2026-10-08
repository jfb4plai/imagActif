import { createAccountHandler } from './_lib/handlers/account.js'
import { requireUser } from './_lib/auth.js'
import { createRepo } from './_lib/repo.js'

export default createAccountHandler({ requireUser, repo: createRepo() })
