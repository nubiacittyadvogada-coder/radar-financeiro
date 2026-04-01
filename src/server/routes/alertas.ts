import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../lib/auth'
import prisma from '../lib/db'

const router = Router()
router.use(authMiddleware)

// GET /api/alertas — alertas do cliente autenticado
router.get('/', async (req: AuthRequest, res: Response) => {
  let clienteId: string

  if (req.usuario!.tipo === 'cliente') {
    clienteId = req.usuario!.id
  } else {
    // BPO pode ver alertas de qualquer cliente seu passando ?clienteId=
    const cid = req.query.clienteId as string
    if (!cid) {
      res.status(400).json({ erro: 'clienteId obrigatório para BPO' })
      return
    }
    clienteId = cid
  }

  const alertas = await prisma.alerta.findMany({
    where: { clienteId },
    orderBy: { criadoEm: 'desc' },
    take: 20,
  })

  res.json(alertas)
})

// PUT /api/alertas/:id/visualizado
router.put('/:id/visualizado', async (req: AuthRequest, res: Response) => {
  const alerta = await prisma.alerta.findUnique({
    where: { id: req.params.id },
  })

  if (!alerta) {
    res.status(404).json({ erro: 'Alerta não encontrado' })
    return
  }

  // Verificar acesso
  if (req.usuario!.tipo === 'cliente' && alerta.clienteId !== req.usuario!.id) {
    res.status(403).json({ erro: 'Acesso negado' })
    return
  }

  await prisma.alerta.update({
    where: { id: req.params.id },
    data: { enviado: true, enviadoEm: new Date() },
  })

  res.json({ ok: true })
})

export default router
