import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export const maxDuration = 60

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json([])
    const metas = await prisma.metaPessoal.findMany({
      where: { contaPessoalId: conta.id },
      orderBy: { criadoEm: 'desc' },
    })
    return Response.json(metas)
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

    const { titulo, descricao, valorMeta, prazo } = await req.json()
    const meta = await prisma.metaPessoal.create({
      data: {
        contaPessoalId: conta.id,
        titulo,
        descricao: descricao || null,
        valorMeta,
        prazo: prazo ? new Date(prazo) : null,
      },
    })
    return Response.json(meta, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
