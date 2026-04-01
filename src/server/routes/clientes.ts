import { Router, Response } from 'express'
import { authMiddleware, apenassBpo, AuthRequest, hashSenha } from '../lib/auth'
import prisma from '../lib/db'

const router = Router()

// Todas as rotas exigem autenticação de BPO
router.use(authMiddleware)
router.use(apenassBpo)

// GET /api/clientes — lista clientes do BPO
router.get('/', async (req: AuthRequest, res: Response) => {
  const clientes = await prisma.cliente.findMany({
    where: { bpoId: req.usuario!.bpoId!, ativo: true },
    orderBy: { nomeEmpresa: 'asc' },
    select: {
      id: true,
      nomeEmpresa: true,
      cnpj: true,
      setor: true,
      responsavel: true,
      telefone: true,
      email: true,
      ativo: true,
      alertaWpp: true,
      criadoEm: true,
      _count: {
        select: { importacoes: true, fechamentos: true },
      },
    },
  })

  res.json(clientes)
})

// POST /api/clientes — cria novo cliente
router.post('/', async (req: AuthRequest, res: Response) => {
  const {
    nomeEmpresa, cnpj, setor, responsavel, telefone, email,
    senha, alertaWpp, telefoneWpp, metaLucro, metaReceita,
  } = req.body

  if (!nomeEmpresa) {
    res.status(400).json({ erro: 'Nome da empresa é obrigatório' })
    return
  }

  const senhaHash = senha ? await hashSenha(senha) : null

  const cliente = await prisma.cliente.create({
    data: {
      bpoId: req.usuario!.bpoId!,
      nomeEmpresa,
      cnpj,
      setor,
      responsavel,
      telefone,
      email,
      senhaHash,
      alertaWpp: alertaWpp || false,
      telefoneWpp,
      metaLucro,
      metaReceita,
    },
  })

  res.status(201).json(cliente)
})

// GET /api/clientes/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const cliente = await prisma.cliente.findFirst({
    where: { id: req.params.id, bpoId: req.usuario!.bpoId! },
    include: {
      _count: {
        select: { importacoes: true, fechamentos: true, alertas: true },
      },
    },
  })

  if (!cliente) {
    res.status(404).json({ erro: 'Cliente não encontrado' })
    return
  }

  res.json(cliente)
})

// PUT /api/clientes/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const {
    nomeEmpresa, cnpj, setor, responsavel, telefone, email,
    senha, alertaWpp, telefoneWpp, metaLucro, metaReceita,
  } = req.body

  // Verifica que pertence ao BPO
  const existente = await prisma.cliente.findFirst({
    where: { id: req.params.id, bpoId: req.usuario!.bpoId! },
  })

  if (!existente) {
    res.status(404).json({ erro: 'Cliente não encontrado' })
    return
  }

  const data: any = {}
  if (nomeEmpresa !== undefined) data.nomeEmpresa = nomeEmpresa
  if (cnpj !== undefined) data.cnpj = cnpj
  if (setor !== undefined) data.setor = setor
  if (responsavel !== undefined) data.responsavel = responsavel
  if (telefone !== undefined) data.telefone = telefone
  if (email !== undefined) data.email = email
  if (alertaWpp !== undefined) data.alertaWpp = alertaWpp
  if (telefoneWpp !== undefined) data.telefoneWpp = telefoneWpp
  if (metaLucro !== undefined) data.metaLucro = metaLucro
  if (metaReceita !== undefined) data.metaReceita = metaReceita
  if (senha) data.senhaHash = await hashSenha(senha)

  const cliente = await prisma.cliente.update({
    where: { id: req.params.id },
    data,
  })

  res.json(cliente)
})

// DELETE /api/clientes/:id — soft delete
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const existente = await prisma.cliente.findFirst({
    where: { id: req.params.id, bpoId: req.usuario!.bpoId! },
  })

  if (!existente) {
    res.status(404).json({ erro: 'Cliente não encontrado' })
    return
  }

  await prisma.cliente.update({
    where: { id: req.params.id },
    data: { ativo: false },
  })

  res.json({ ok: true })
})

export default router
