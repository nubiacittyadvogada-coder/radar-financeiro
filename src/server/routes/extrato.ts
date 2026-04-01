import { Router, Response } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { authMiddleware, AuthRequest } from '../lib/auth'
import prisma from '../lib/db'
import { parsearOFX, parsearCSV } from '../lib/parsearExtrato'
import { categorizarTransacoes } from '../lib/categorizarExtrato'
import { calcularFechamento } from '../lib/calcularFechamento'

const router = Router()
router.use(authMiddleware)

// Configurar upload
const storagePath = process.env.STORAGE_PATH || './uploads'
if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, storagePath),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `extrato-${Date.now()}${ext}`)
    },
  }),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (['.ofx', '.csv', '.txt'].includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Formato inválido. Use OFX ou CSV.'))
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
})

// POST /api/extrato/preview — lê e categoriza, retorna preview para o usuário confirmar
router.post('/preview', upload.single('arquivo'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ erro: 'Arquivo não enviado' })
    return
  }

  const banco = (req.body.banco || 'ofx').toLowerCase()
  const clienteId = req.usuario!.tipo === 'cliente'
    ? req.usuario!.id
    : req.body.clienteId

  if (!clienteId) {
    res.status(400).json({ erro: 'clienteId obrigatório' })
    return
  }

  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { nomeEmpresa: true, setor: true }
    })

    if (!cliente) {
      res.status(404).json({ erro: 'Cliente não encontrado' })
      return
    }

    // Ler arquivo
    const conteudo = fs.readFileSync(req.file.path, 'latin1')
    const ext = path.extname(req.file.originalname).toLowerCase()

    // Parsear conforme formato
    let transacoes
    if (ext === '.ofx' || banco === 'ofx') {
      transacoes = parsearOFX(conteudo)
    } else {
      transacoes = parsearCSV(conteudo, banco)
    }

    if (transacoes.length === 0) {
      res.status(400).json({ erro: 'Nenhuma transação encontrada no arquivo. Verifique se é o formato correto.' })
      return
    }

    // Categorizar com IA
    const categorizadas = await categorizarTransacoes(
      transacoes,
      cliente.nomeEmpresa,
      cliente.setor || 'empresa'
    )

    // Limpar arquivo temporário
    fs.unlink(req.file.path, () => {})

    res.json({
      total: categorizadas.length,
      transacoes: categorizadas.map(t => ({
        ...t,
        data: t.data.toISOString(),
      })),
    })
  } catch (err: any) {
    fs.unlink(req.file?.path || '', () => {})
    res.status(500).json({ erro: err.message })
  }
})

// POST /api/extrato/confirmar — salva as transações confirmadas
router.post('/confirmar', async (req: AuthRequest, res: Response) => {
  const clienteId = req.usuario!.tipo === 'cliente'
    ? req.usuario!.id
    : req.body.clienteId

  if (!clienteId) {
    res.status(400).json({ erro: 'clienteId obrigatório' })
    return
  }

  const { transacoes } = req.body as {
    transacoes: Array<{
      data: string
      descricao: string
      valor: number
      tipo: string
      planoConta: string
      grupoConta: string
      tipoContabil: string
      categoriaLabel: string
      ignorar: boolean
    }>
  }

  if (!transacoes || transacoes.length === 0) {
    res.status(400).json({ erro: 'Nenhuma transação para salvar' })
    return
  }

  try {
    const paraLancar = transacoes.filter(t => !t.ignorar)
    const mesAnos = new Set<string>()

    for (const t of paraLancar) {
      const dataObj = new Date(t.data)
      const mes = dataObj.getMonth() + 1
      const ano = dataObj.getFullYear()
      mesAnos.add(`${mes}-${ano}`)

      await prisma.lancamentoManual.create({
        data: {
          clienteId,
          tipo: t.tipo === 'credito' ? 'receita' : 'despesa',
          descricao: t.descricao,
          planoConta: t.planoConta,
          grupoConta: t.grupoConta,
          tipoContabil: t.tipoContabil,
          valor: t.valor,
          data: dataObj,
          mes,
          ano,
          previsto: false,
          observacoes: `Importado do extrato bancário`,
        }
      })
    }

    // Recalcular fechamentos de todos os meses afetados
    for (const mesAno of mesAnos) {
      const [mes, ano] = mesAno.split('-').map(Number)
      await calcularFechamento(clienteId, mes, ano)
    }

    res.json({
      ok: true,
      salvos: paraLancar.length,
      ignorados: transacoes.length - paraLancar.length,
      mesesAtualizados: [...mesAnos],
    })
  } catch (err: any) {
    res.status(500).json({ erro: err.message })
  }
})

export default router
