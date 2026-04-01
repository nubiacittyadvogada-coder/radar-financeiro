import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../lib/auth'
import prisma from '../lib/db'
import { classificar } from '../lib/classificador'
import { calcularFechamento } from '../lib/calcularFechamento'

const router = Router()
router.use(authMiddleware)

// GET /api/lancamentos — listar lançamentos manuais
router.get('/', async (req: AuthRequest, res) => {
  try {
    const clienteId = req.usuario!.tipo === 'cliente'
      ? req.usuario!.id
      : (req.query.clienteId as string)

    if (!clienteId) return res.status(400).json({ erro: 'clienteId obrigatório' })

    const mes = req.query.mes ? Number(req.query.mes) : undefined
    const ano = req.query.ano ? Number(req.query.ano) : undefined

    const lancamentos = await prisma.lancamentoManual.findMany({
      where: {
        clienteId,
        ...(mes ? { mes } : {}),
        ...(ano ? { ano } : {}),
      },
      orderBy: { data: 'desc' },
    })

    res.json(lancamentos)
  } catch (err: any) {
    res.status(500).json({ erro: err.message })
  }
})

// POST /api/lancamentos — criar lançamento manual
router.post('/', async (req: AuthRequest, res) => {
  try {
    const clienteId = req.usuario!.tipo === 'cliente'
      ? req.usuario!.id
      : req.body.clienteId

    if (!clienteId) return res.status(400).json({ erro: 'clienteId obrigatório' })

    const { tipo, descricao, favorecido, planoConta, valor, data, previsto, observacoes } = req.body

    if (!tipo || !descricao || !planoConta || !valor || !data) {
      return res.status(400).json({ erro: 'Campos obrigatórios: tipo, descricao, planoConta, valor, data' })
    }

    // Classificar pelo plano de contas
    let classificacao
    try {
      classificacao = classificar(planoConta)
    } catch {
      return res.status(400).json({ erro: `Plano de contas inválido: ${planoConta}` })
    }

    const dataObj = new Date(data)
    const mes = dataObj.getMonth() + 1
    const ano = dataObj.getFullYear()

    const lancamento = await prisma.lancamentoManual.create({
      data: {
        clienteId,
        tipo,
        descricao,
        favorecido: favorecido || null,
        planoConta,
        grupoConta: classificacao.grupoConta,
        tipoContabil: classificacao.tipo,
        valor: Math.abs(Number(valor)),
        data: dataObj,
        mes,
        ano,
        previsto: previsto || false,
        observacoes: observacoes || null,
      },
    })

    // Recalcular fechamento do mês
    await calcularFechamento(clienteId, mes, ano)

    res.status(201).json(lancamento)
  } catch (err: any) {
    res.status(500).json({ erro: err.message })
  }
})

// DELETE /api/lancamentos/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const lancamento = await prisma.lancamentoManual.findUnique({ where: { id: req.params.id } })
    if (!lancamento) return res.status(404).json({ erro: 'Lançamento não encontrado' })

    // Verifica permissão
    const clienteId = req.usuario!.tipo === 'cliente' ? req.usuario!.id : null
    if (clienteId && lancamento.clienteId !== clienteId) {
      return res.status(403).json({ erro: 'Sem permissão' })
    }

    await prisma.lancamentoManual.delete({ where: { id: req.params.id } })

    // Recalcular fechamento
    await calcularFechamento(lancamento.clienteId, lancamento.mes, lancamento.ano)

    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ erro: err.message })
  }
})

export default router
