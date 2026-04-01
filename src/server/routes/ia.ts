import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../lib/auth'
import { responderPergunta, gerarEstrategia } from '../lib/iaFinanceira'
import prisma from '../lib/db'

const router = Router()
router.use(authMiddleware)

// GET /api/ia/status — diagnóstico da chave Anthropic
router.get('/status', (_req, res: Response) => {
  const key = process.env.ANTHROPIC_API_KEY
  res.json({
    configurada: !!key,
    prefixo: key ? key.substring(0, 20) + '...' : null,
  })
})

// POST /api/ia/perguntar
router.post('/perguntar', async (req: AuthRequest, res: Response) => {
  const { pergunta, mes, ano } = req.body

  if (!pergunta) {
    res.status(400).json({ erro: 'Pergunta é obrigatória' })
    return
  }

  // Determinar clienteId
  let clienteId: string
  if (req.usuario!.tipo === 'cliente') {
    clienteId = req.usuario!.id
  } else {
    clienteId = req.body.clienteId
    if (!clienteId) {
      res.status(400).json({ erro: 'clienteId obrigatório para BPO' })
      return
    }
  }

  try {
    const resposta = await responderPergunta(clienteId, pergunta, mes, ano)
    res.json({ resposta, mes, ano })
  } catch (err: any) {
    res.status(500).json({ erro: 'Erro ao processar pergunta', detalhe: err.message })
  }
})

// GET /api/ia/historico
router.get('/historico', async (req: AuthRequest, res: Response) => {
  let clienteId: string
  if (req.usuario!.tipo === 'cliente') {
    clienteId = req.usuario!.id
  } else {
    clienteId = req.query.clienteId as string
    if (!clienteId) {
      res.status(400).json({ erro: 'clienteId obrigatório para BPO' })
      return
    }
  }

  const conversas = await prisma.conversaIA.findMany({
    where: { clienteId },
    orderBy: { criadoEm: 'desc' },
    take: 20,
  })

  res.json(conversas)
})

// POST /api/ia/estrategia
router.post('/estrategia', async (req: AuthRequest, res: Response) => {
  let clienteId: string
  if (req.usuario!.tipo === 'cliente') {
    clienteId = req.usuario!.id
  } else {
    clienteId = req.body.clienteId
    if (!clienteId) { res.status(400).json({ erro: 'clienteId obrigatório' }); return }
  }
  try {
    const estrategia = await gerarEstrategia(clienteId)
    res.json(estrategia)
  } catch (err: any) {
    res.status(500).json({ erro: err.message })
  }
})

export default router
