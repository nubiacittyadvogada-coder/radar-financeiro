import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../lib/auth'
import prisma from '../lib/db'

const router = Router()
router.use(authMiddleware)

// GET /api/fechamentos/:clienteId?mes=X&ano=Y
router.get('/:clienteId', async (req: AuthRequest, res: Response) => {
  const { clienteId } = req.params
  const mes = parseInt(req.query.mes as string)
  const ano = parseInt(req.query.ano as string)

  // Verificar acesso
  const acesso = await verificarAcesso(req, clienteId)
  if (!acesso) {
    res.status(403).json({ erro: 'Acesso negado' })
    return
  }

  if (!mes || !ano) {
    res.status(400).json({ erro: 'Parâmetros mes e ano são obrigatórios' })
    return
  }

  const fechamento = await prisma.fechamento.findUnique({
    where: { clienteId_mes_ano: { clienteId, mes, ano } },
  })

  if (!fechamento) {
    res.status(404).json({ erro: 'Fechamento não encontrado' })
    return
  }

  // Buscar lançamentos agrupados do período
  const lancamentos = await prisma.lancamento.findMany({
    where: { clienteId, mes, ano, previsto: false },
    orderBy: { valor: 'desc' },
  })

  res.json({ fechamento, lancamentos })
})

// GET /api/fechamentos/:clienteId/historico?ultimos=6
router.get('/:clienteId/historico', async (req: AuthRequest, res: Response) => {
  const { clienteId } = req.params
  const ultimos = parseInt(req.query.ultimos as string) || 6

  const acesso = await verificarAcesso(req, clienteId)
  if (!acesso) {
    res.status(403).json({ erro: 'Acesso negado' })
    return
  }

  const fechamentos = await prisma.fechamento.findMany({
    where: { clienteId },
    orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
    take: ultimos,
    select: {
      id: true,
      mes: true,
      ano: true,
      receitaBruta: true,
      receitaLiquida: true,
      lucroOperacional: true,
      percLucroOp: true,
      lucroLiquido: true,
      percLucroLiq: true,
      saldoFinal: true,
      resultadoCaixa: true,
      retiradaSocios: true,
      totalDespesasAdm: true,
      margemContribuicao: true,
      percMargem: true,
      pdfUrl: true,
    },
  })

  res.json(fechamentos)
})

// Verifica se o usuário tem acesso ao cliente
async function verificarAcesso(req: AuthRequest, clienteId: string): Promise<boolean> {
  if (!req.usuario) return false

  if (req.usuario.tipo === 'cliente') {
    return req.usuario.id === clienteId
  }

  // BPO: verifica que o cliente pertence ao BPO
  if (req.usuario.tipo === 'bpo' || req.usuario.tipo === 'usuario_bpo') {
    const cliente = await prisma.cliente.findFirst({
      where: { id: clienteId, bpoId: req.usuario.bpoId! },
    })
    return !!cliente
  }

  return false
}

export default router
