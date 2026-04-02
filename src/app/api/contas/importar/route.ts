import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    const clienteId = u.tipo === 'cliente' ? u.id : body.clienteId
    if (!clienteId) return Response.json({ erro: 'clienteId obrigatório' }, { status: 400 })

    const { contas } = body
    if (!Array.isArray(contas) || contas.length === 0) {
      return Response.json({ erro: 'contas[] obrigatório' }, { status: 400 })
    }

    const dados = contas.map((c: any) => ({
      clienteId,
      descricao: String(c.descricao || '').trim(),
      fornecedor: c.fornecedor ? String(c.fornecedor).trim() : null,
      valor: Number(c.valor),
      vencimento: new Date(c.vencimento),
      categoria: c.categoria || 'outros',
      observacoes: c.observacoes ? String(c.observacoes).trim() : null,
      status: 'pendente' as const,
      recorrente: false,
      frequencia: null,
    }))

    await prisma.contaPagar.createMany({ data: dados })
    return Response.json({ ok: true, total: dados.length }, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
