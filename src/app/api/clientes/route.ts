import { NextRequest } from 'next/server'
import { getUsuario, isBpo } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { hashSenha } from '@/server/lib/auth'

export async function GET(req: NextRequest) {
  const u = getUsuario(req)
  if (!u || !isBpo(u)) return Response.json({ erro: 'Acesso restrito ao BPO' }, { status: 403 })

  const clientes = await prisma.cliente.findMany({
    where: { bpoId: u.bpoId!, ativo: true },
    orderBy: { nomeEmpresa: 'asc' },
    select: {
      id: true, nomeEmpresa: true, cnpj: true, setor: true,
      responsavel: true, telefone: true, email: true, ativo: true,
      alertaWpp: true, criadoEm: true,
      _count: { select: { importacoes: true, fechamentos: true } },
    },
  })

  return Response.json(clientes)
}

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || !isBpo(u)) return Response.json({ erro: 'Acesso restrito ao BPO' }, { status: 403 })

    const { nomeEmpresa, cnpj, setor, responsavel, telefone, email, senha,
      alertaWpp, telefoneWpp, metaLucro, metaReceita } = await req.json()

    if (!nomeEmpresa) return Response.json({ erro: 'Nome da empresa é obrigatório' }, { status: 400 })

    const senhaHash = senha ? await hashSenha(senha) : null

    const cliente = await prisma.cliente.create({
      data: { bpoId: u.bpoId!, nomeEmpresa, cnpj, setor, responsavel, telefone,
        email, senhaHash, alertaWpp: alertaWpp || false, telefoneWpp, metaLucro, metaReceita },
    })

    return Response.json(cliente, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
