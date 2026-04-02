import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json([])
    const cats = await prisma.categoriaPessoal.findMany({
      where: { contaPessoalId: conta.id },
      orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
    })
    return Response.json(cats)
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
    const { nome, tipo, cor } = await req.json()
    const cat = await prisma.categoriaPessoal.create({
      data: { contaPessoalId: conta.id, nome, tipo, cor: cor || null },
    })
    return Response.json(cat, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
