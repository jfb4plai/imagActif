import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default {
  content: [join(__dirname, 'index.html'), join(__dirname, 'src/**/*.{js,jsx}')],
  theme: { extend: {} },
  plugins: [],
}
