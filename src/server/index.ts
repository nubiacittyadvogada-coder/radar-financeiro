import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cron from 'node-cron'

// Health check primeiro (sem dependências)
const app = express()
const PORT = process.env.PORT || process.env.API_PORT || 3001

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check (sem banco — responde imediatamente)
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

// Env check
app.get('/api/healthenv', (_req, res) => {
  const dbUrl = process.env.DATABASE_URL || ''
  res.json({
    PORT: process.env.PORT,
    API_PORT: process.env.API_PORT,
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL_INICIO: dbUrl.substring(0, 30) + '...',
    JWT_SECRET_OK: !!process.env.JWT_SECRET,
    ANTHROPIC_KEY_OK: !!process.env.ANTHROPIC_API_KEY,
  })
})

// Iniciar servidor ANTES de carregar rotas pesadas
const server = app.listen(PORT, () => {
  console.log(`[Radar Financeiro] API rodando em http://localhost:${PORT}`)
})

// Carregar rotas de forma assíncrona (não trava o startup)
async function carregarRotas() {
  try {
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
    const { enviarLembreteContas } = await import('./lib/lembreteContas')

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

    // Cron: todo dia às 8h
    cron.schedule('0 8 * * *', async () => {
      console.log('[Cron] Verificando contas a pagar...')
      await enviarLembreteContas().catch(console.error)
    }, { timezone: 'America/Sao_Paulo' })

    console.log('[Radar Financeiro] Rotas carregadas com sucesso')
    console.log('[Radar Financeiro] Lembretes de contas: todo dia às 8h')
  } catch (err: any) {
    console.error('[Radar Financeiro] ERRO ao carregar rotas:', err.message)
    console.error(err.stack)
  }
}

carregarRotas()

export default app
