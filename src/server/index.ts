import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/healthenv', (_req, res) => {
  const dbUrl = process.env.DATABASE_URL || ''
  res.json({
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL_INICIO: dbUrl ? dbUrl.substring(0, 35) + '...' : 'NAO DEFINIDO',
    JWT_SECRET_OK: !!process.env.JWT_SECRET,
    ANTHROPIC_KEY_OK: !!process.env.ANTHROPIC_API_KEY,
  })
})

app.get('/api/healthdb', async (_req, res) => {
  try {
    const { PrismaClient } = await import('@prisma/client')
    const p = new PrismaClient()
    await p.$queryRaw`SELECT 1`
    await p.$disconnect()
    res.json({ db: 'ok' })
  } catch (err: any) {
    res.json({ db: 'erro', detalhe: err.message })
  }
})

// Carregar rotas dinamicamente após startup
async function main() {
  const { default: authRoutes } = await import('./routes/auth')
  const { default: clientesRoutes } = await import('./routes/clientes')
  const { default: fechamentosRoutes } = await import('./routes/fechamentos')
  const { default: alertasRoutes } = await import('./routes/alertas')
  const { default: importacaoRoutes } = await import('./routes/importacao')
  const { default: iaRoutes } = await import('./routes/ia')
  const { default: relatorioRoutes } = await import('./routes/relatorio')
  const { default: lancamentosRoutes } = await import('./routes/lancamentos')
  const { default: contasRoutes } = await import('./routes/contas')
  const { default: extratoRoutes } = await import('./routes/extrato')

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

  console.log('[Radar Financeiro] Todas as rotas carregadas')

  // Cron
  const cron = await import('node-cron')
  const { enviarLembreteContas } = await import('./lib/lembreteContas')
  cron.default.schedule('0 8 * * *', async () => {
    await enviarLembreteContas().catch(console.error)
  }, { timezone: 'America/Sao_Paulo' })
}

app.listen(PORT, () => {
  console.log(`[Radar Financeiro] API rodando em http://localhost:${PORT}`)
  main().catch(err => {
    console.error('[Radar Financeiro] ERRO nas rotas:', err.message, err.stack)
  })
})

export default app
