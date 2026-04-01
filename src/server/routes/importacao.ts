import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { authMiddleware, apenassBpo, AuthRequest } from '../lib/auth'
import prisma from '../lib/db'
import { processarImportacao } from '../lib/processarExcel'

const router = Router()
router.use(authMiddleware)
router.use(apenassBpo)

// Configurar multer
const storagePath = process.env.STORAGE_PATH || './uploads'
if (!fs.existsSync(storagePath)) {
  fs.mkdirSync(storagePath, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, storagePath),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, `import-${uniqueSuffix}${ext}`)
  },
})

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (['.xlsx', '.xls'].includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Apenas arquivos Excel (.xlsx, .xls) são aceitos'))
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
})

// POST /api/importacao/upload
router.post('/upload', upload.single('arquivo'), async (req: AuthRequest, res: Response) => {
  const { clienteId, tipo, mes, ano } = req.body

  if (!clienteId || !tipo || !mes || !ano) {
    res.status(400).json({ erro: 'clienteId, tipo, mes e ano são obrigatórios' })
    return
  }

  if (!['receitas', 'despesas'].includes(tipo)) {
    res.status(400).json({ erro: 'Tipo deve ser "receitas" ou "despesas"' })
    return
  }

  if (!req.file) {
    res.status(400).json({ erro: 'Arquivo não enviado' })
    return
  }

  // Verificar que o cliente pertence ao BPO
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, bpoId: req.usuario!.bpoId! },
  })

  if (!cliente) {
    res.status(404).json({ erro: 'Cliente não encontrado' })
    return
  }

  // Criar registro de importação
  const importacao = await prisma.importacao.create({
    data: {
      clienteId,
      tipo,
      nomeArquivo: req.file.filename,
      mes: parseInt(mes),
      ano: parseInt(ano),
      status: 'processando',
    },
  })

  // Processar de forma síncrona (pode ser convertido para Bull queue depois)
  try {
    await processarImportacao(importacao.id)

    const importacaoAtualizada = await prisma.importacao.findUnique({
      where: { id: importacao.id },
    })

    const fechamento = await prisma.fechamento.findUnique({
      where: {
        clienteId_mes_ano: {
          clienteId,
          mes: parseInt(mes),
          ano: parseInt(ano),
        },
      },
    })

    res.json({
      importacaoId: importacao.id,
      status: importacaoAtualizada?.status,
      totalLinhas: importacaoAtualizada?.totalLinhas,
      linhasProcessadas: importacaoAtualizada?.linhasProcessadas,
      erros: importacaoAtualizada?.erro,
      fechamento,
    })
  } catch (err: any) {
    res.status(500).json({
      importacaoId: importacao.id,
      status: 'erro',
      erro: err.message,
    })
  }
})

// GET /api/importacao/:id/status
router.get('/:id/status', async (req: AuthRequest, res: Response) => {
  const importacao = await prisma.importacao.findUnique({
    where: { id: req.params.id },
    include: {
      cliente: { select: { bpoId: true } },
    },
  })

  if (!importacao || importacao.cliente.bpoId !== req.usuario!.bpoId!) {
    res.status(404).json({ erro: 'Importação não encontrada' })
    return
  }

  const fechamento = await prisma.fechamento.findUnique({
    where: {
      clienteId_mes_ano: {
        clienteId: importacao.clienteId,
        mes: importacao.mes,
        ano: importacao.ano,
      },
    },
  })

  res.json({
    id: importacao.id,
    status: importacao.status,
    tipo: importacao.tipo,
    totalLinhas: importacao.totalLinhas,
    linhasProcessadas: importacao.linhasProcessadas,
    erro: importacao.erro,
    fechamento,
  })
})

export default router
