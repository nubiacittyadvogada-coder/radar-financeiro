import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const contas = await prisma.contaPagarEmpresa.findMany({
      where: { contaEmpresaId: conta.id },
      orderBy: { vencimento: 'asc' },
    })
    return Response.json(contas)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const body = await req.json()
    const nova = await prisma.contaPagarEmpresa.create({
      data: {
        contaEmpresaId: conta.id,
        descricao: body.descricao,
        fornecedor: body.fornecedor || null,
        valor: body.valor,
        vencimento: new Date(body.vencimento),
        recorrente: body.recorrente || false,
        frequencia: body.frequencia || null,
        categoria: body.categoria || null,
        observacoes: body.observacoes || null,
      },
    })
    return Response.json(nova, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
