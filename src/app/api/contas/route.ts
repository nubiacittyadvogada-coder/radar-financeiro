import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const clienteId = u.tipo === 'cliente' ? u.id : new URL(req.url).searchParams.get('clienteId') || ''
    if (!clienteId) return Response.json({ erro: 'clienteId obrigatório' }, { status: 400 })

    await prisma.contaPagar.updateMany({
      where: { clienteId, status: 'pendente', vencimento: { lt: new Date() } },
      data: { status: 'atrasado' },
    })

    const contas = await prisma.contaPagar.findMany({
      where: { clienteId },
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
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    const clienteId = u.tipo === 'cliente' ? u.id : body.clienteId
    if (!clienteId) return Response.json({ erro: 'clienteId obrigatório' }, { status: 400 })

    const { descricao, fornecedor, valor, vencimento, recorrente, frequencia, categoria, observacoes } = body
    if (!descricao || !valor || !vencimento) {
      return Response.json({ erro: 'Campos obrigatórios: descricao, valor, vencimento' }, { status: 400 })
    }

    const conta = await prisma.contaPagar.create({
      data: {
        clienteId, descricao, fornecedor: fornecedor || null,
        valor: Number(valor), vencimento: new Date(vencimento),
        recorrente: recorrente || false, frequencia: frequencia || null,
        categoria: categoria || 'outros', observacoes: observacoes || null, status: 'pendente',
      },
    })

    return Response.json(conta, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
