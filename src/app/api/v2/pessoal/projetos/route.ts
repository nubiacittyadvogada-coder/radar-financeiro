import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json([])
    const projetos = await prisma.projetoPessoal.findMany({
      where: { contaPessoalId: conta.id },
      include: { _count: { select: { transacoes: true } } },
      orderBy: { criadoEm: 'desc' },
    })
    return Response.json(projetos)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta pessoal não encontrada' }, { status: 404 })
    const { nome, descricao, orcamento, cor } = await req.json()
    const p = await prisma.projetoPessoal.create({
      data: { contaPessoalId: conta.id, nome, descricao: descricao || null, orcamento: orcamento || null, cor: cor || null },
    })
    return Response.json(p, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
