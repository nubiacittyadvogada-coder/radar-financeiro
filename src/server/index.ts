import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import cron from 'node-cron'

import authRoutes from './routes/auth'
import clientesRoutes from './routes/clientes'
import fechamentosRoutes from './routes/fechamentos'
import alertasRoutes from './routes/alertas'
import importacaoRoutes from './routes/importacao'
import iaRoutes from './routes/ia'
import relatorioRoutes from './routes/relatorio'
import lancamentosRoutes from './routes/lancamentos'
import contasRoutes from './routes/contas'
import extratoRoutes from './routes/extrato'
import { enviarLembreteContas } from './lib/lembreteContas'

const app = express()
const PORT = process.env.PORT || process.env.API_PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Criar pasta de uploads
const uploadsDir = process.env.STORAGE_PATH || './uploads'

// Rotas
app.use('/api/auth', authRoutes)
app.use('/api/clientes', clientesRoutes)
app.use('/api/fechamentos', fechamentosRoutes)
app.use('/api/alertas', alertasRoutes)
app.use('/api/importacao', importacaoRoutes)
app.use('/api/ia', iaRoutes)
app.use('/api/relatorio', relatorioRoutes)
app.use('/api/lancamentos', lancamentosRoutes)
app.use('/api/contas', contasRoutes)
app.use('/api/extrato', extratoRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// DB check
app.get('/api/healthdb', async (_req, res) => {
  try {
    const { PrismaClient } = await import('@prisma/client')
    const p = new PrismaClient()
    await Promise.race([
      p.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout 5s')), 5000))
    ])
    await p.$disconnect()
    res.json({ db: 'ok' })
  } catch (err: any) {
    res.json({ db: 'erro', detalhe: err.message })
  }
})

// Cron: todo dia às 8h verifica contas a pagar e envia lembretes
cron.schedule('0 8 * * *', async () => {
  console.log('[Cron] Verificando contas a pagar...')
  await enviarLembreteContas().catch(console.error)
}, { timezone: 'America/Sao_Paulo' })

app.listen(PORT, () => {
  console.log(`[Radar Financeiro] API rodando em http://localhost:${PORT}`)
  console.log(`[Radar Financeiro] Lembretes de contas: todo dia às 8h`)
})

export default app
