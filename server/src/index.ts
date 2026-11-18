import 'dotenv/config'
import path from 'path'
import fs from 'fs'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { HttpError } from './lib'
import routes from './routes'

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.set('trust proxy', 1)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // Portraits come from D&D Beyond's CDN or any URL the GM pastes.
        'img-src': ["'self'", 'data:', 'https:'],
      },
    },
  })
)
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false }))
app.use(express.json({ limit: '300kb' }))

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: process.env.APP_VERSION || 'dev' }))
app.use('/api', routes)
app.use('/api', (_req, res) => res.status(404).json({ error: 'Nenalezeno' }))

// In the image the built client sits next to dist/ in public/.
const publicDir = path.join(__dirname, '../public')
if (fs.existsSync(publicDir)) {
  app.use(
    express.static(publicDir, {
      index: false,
      maxAge: '1y',
      immutable: true,
      // Hashed bundles can be cached for ever; the rest keep their names and must be re-checked,
      // or an installed app never sees an update.
      setHeaders: (res, file) => {
        if (!/[\\/]assets[\\/]/.test(file)) res.setHeader('Cache-Control', 'no-cache')
      },
    })
  )
  app.get('/{*splat}', (_req, res) => {
    res.set('Cache-Control', 'no-cache')
    res.sendFile(path.join(publicDir, 'index.html'))
  })
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code })
  if (err instanceof SyntaxError) return res.status(400).json({ error: 'Neplatný JSON' })
  console.error('[Error]', err)
  res.status(500).json({ error: 'Interní chyba serveru' })
})

if (!process.env.CREATE_KEY) console.warn('CREATE_KEY není nastavený, novou kampaň nepůjde založit')

app.listen(PORT, () => console.log(`Družina běží na :${PORT}`))
