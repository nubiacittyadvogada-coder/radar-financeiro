import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const { contas } = await req.json()
    if (!Array.isArray(contas) || contas.length === 0) {
      return Response.json({ erro: 'contas[] obrigatório' }, { status: 400 })
    }

    const dados = contas.map((c: any) => ({
      contaEmpresaId: conta.id,
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

    await prisma.contaPagarEmpresa.createMany({ data: dados })
    return Response.json({ ok: true, total: dados.length }, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
