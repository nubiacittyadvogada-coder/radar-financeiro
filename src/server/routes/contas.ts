import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../lib/auth'
import prisma from '../lib/db'

const router = Router()
router.use(authMiddleware)

// GET /api/contas — listar contas a pagar
router.get('/', async (req: AuthRequest, res) => {
  try {
    const clienteId = req.usuario!.tipo === 'cliente'
      ? req.usuario!.id
      : (req.query.clienteId as string)

    if (!clienteId) return res.status(400).json({ erro: 'clienteId obrigatório' })

    // Atualizar status de contas vencidas
    await prisma.contaPagar.updateMany({
      where: {
        clienteId,
        status: 'pendente',
        vencimento: { lt: new Date() },
      },
      data: { status: 'atrasado' },
    })

    const contas = await prisma.contaPagar.findMany({
      where: { clienteId },
      orderBy: { vencimento: 'asc' },
    })

    res.json(contas)
  } catch (err: any) {
    res.status(500).json({ erro: err.message })
  }
})

// GET /api/contas/alertas — contas para hoje e próximos 7 dias
router.get('/alertas', async (req: AuthRequest, res) => {
  try {
    const clienteId = req.usuario!.tipo === 'cliente'
      ? req.usuario!.id
      : (req.query.clienteId as string)

    if (!clienteId) return res.status(400).json({ erro: 'clienteId obrigatório' })

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const em7dias = new Date(hoje)
    em7dias.setDate(em7dias.getDate() + 7)
    em7dias.setHours(23, 59, 59, 999)

    // Contas vencidas
    const atrasadas = await prisma.contaPagar.findMany({
      where: {
        clienteId,
        status: 'atrasado',
      },
      orderBy: { vencimento: 'asc' },
    })

    // Contas vencem hoje ou nos próximos 7 dias
    const proximas = await prisma.contaPagar.findMany({
      where: {
        clienteId,
        status: 'pendente',
        vencimento: { gte: hoje, lte: em7dias },
      },
      orderBy: { vencimento: 'asc' },
    })

    res.json({ atrasadas, proximas })
  } catch (err: any) {
    res.status(500).json({ erro: err.message })
  }
})

// POST /api/contas — criar conta a pagar
router.post('/', async (req: AuthRequest, res) => {
  try {
    const clienteId = req.usuario!.tipo === 'cliente'
      ? req.usuario!.id
      : req.body.clienteId

    if (!clienteId) return res.status(400).json({ erro: 'clienteId obrigatório' })

    const { descricao, fornecedor, valor, vencimento, recorrente, frequencia, categoria, observacoes } = req.body

    if (!descricao || !valor || !vencimento) {
      return res.status(400).json({ erro: 'Campos obrigatórios: descricao, valor, vencimento' })
    }

    const conta = await prisma.contaPagar.create({
      data: {
        clienteId,
        descricao,
        fornecedor: fornecedor || null,
        valor: Number(valor),
        vencimento: new Date(vencimento),
        recorrente: recorrente || false,
        frequencia: frequencia || null,
        categoria: categoria || 'outros',
        observacoes: observacoes || null,
        status: 'pendente',
      },
    })

    res.status(201).json(conta)
  } catch (err: any) {
    res.status(500).json({ erro: err.message })
  }
})

// PUT /api/contas/:id/pagar — marcar como pago
router.put('/:id/pagar', async (req: AuthRequest, res) => {
  try {
    const conta = await prisma.contaPagar.findUnique({ where: { id: req.params.id } })
    if (!conta) return res.status(404).json({ erro: 'Conta não encontrada' })

    // Marcar como pago
    await prisma.contaPagar.update({
      where: { id: req.params.id },
      data: { status: 'pago', pagoEm: new Date() },
    })

    // Se recorrente, criar próxima parcela automaticamente
    if (conta.recorrente && conta.frequencia) {
      const proxVenc = new Date(conta.vencimento)
      if (conta.frequencia === 'mensal') proxVenc.setMonth(proxVenc.getMonth() + 1)
      else if (conta.frequencia === 'quinzenal') proxVenc.setDate(proxVenc.getDate() + 15)
      else if (conta.frequencia === 'semanal') proxVenc.setDate(proxVenc.getDate() + 7)
      else if (conta.frequencia === 'anual') proxVenc.setFullYear(proxVenc.getFullYear() + 1)

      await prisma.contaPagar.create({
        data: {
          clienteId: conta.clienteId,
          descricao: conta.descricao,
          fornecedor: conta.fornecedor,
          valor: conta.valor,
          vencimento: proxVenc,
          recorrente: true,
          frequencia: conta.frequencia,
          categoria: conta.categoria,
          status: 'pendente',
        },
      })
    }

    res.json({ ok: true, recorrente: conta.recorrente })
  } catch (err: any) {
    res.status(500).json({ erro: err.message })
  }
})

// DELETE /api/contas/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const conta = await prisma.contaPagar.findUnique({ where: { id: req.params.id } })
    if (!conta) return res.status(404).json({ erro: 'Conta não encontrada' })

    const clienteId = req.usuario!.tipo === 'cliente' ? req.usuario!.id : null
    if (clienteId && conta.clienteId !== clienteId) {
      return res.status(403).json({ erro: 'Sem permissão' })
    }

    await prisma.contaPagar.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ erro: err.message })
  }
})

export default router
