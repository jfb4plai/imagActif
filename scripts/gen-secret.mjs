import { randomBytes } from 'node:crypto'

const secrets = JSON.stringify({ 1: randomBytes(32).toString('base64') })
console.log('IMG_KEY_SECRETS=' + secrets)
console.log('IMG_KEY_CURRENT=1')
console.log('CRON_SECRET=' + randomBytes(32).toString('hex'))
console.log('\nPoser chaque valeur dans Vercel avec printf (pas echo), puis vérifier avec `vercel env pull`.')
