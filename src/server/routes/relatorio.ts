import { Router, Response } from 'express'
import path from 'path'
import fs from 'fs'
import { authMiddleware, AuthRequest } from '../lib/auth'
import { gerarRelatorioPdf } from '../lib/gerarRelatorio'
import prisma from '../lib/db'

const router = Router()
router.use(authMiddleware)

// GET /api/relatorio/:clienteId/:mes/:ano/pdf
router.get('/:clienteId/:mes/:ano/pdf', async (req: AuthRequest, res: Response) => {
  const { clienteId, mes, ano } = req.params
  const mesNum = parseInt(mes)
  const anoNum = parseInt(ano)

  // Verificar acesso
  if (req.usuario!.tipo === 'cliente' && req.usuario!.id !== clienteId) {
    res.status(403).json({ erro: 'Acesso negado' })
    return
  }

  if (req.usuario!.tipo === 'bpo' || req.usuario!.tipo === 'usuario_bpo') {
    const cliente = await prisma.cliente.findFirst({
      where: { id: clienteId, bpoId: req.usuario!.bpoId! },
    })
    if (!cliente) {
      res.status(404).json({ erro: 'Cliente não encontrado' })
      return
    }
  }

  // Verificar se PDF já existe
  const fechamento = await prisma.fechamento.findUnique({
    where: { clienteId_mes_ano: { clienteId, mes: mesNum, ano: anoNum } },
  })

  if (!fechamento) {
    res.status(404).json({ erro: 'Fechamento não encontrado' })
    return
  }

  try {
    // Sempre gera novo (ou poderia checar pdfUrl existente)
    const filePath = await gerarRelatorioPdf(clienteId, mesNum, anoNum)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `inline; filename="relatorio-${mesNum}-${anoNum}.pdf"`
    )

    const stream = fs.createReadStream(filePath)
    stream.pipe(res)
  } catch (err: any) {
    res.status(500).json({ erro: 'Erro ao gerar relatório', detalhe: err.message })
  }
})

export default router
