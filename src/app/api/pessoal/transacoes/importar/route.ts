import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const { clienteId, transacoes } = await req.json()
    if (!clienteId || !Array.isArray(transacoes) || transacoes.length === 0) {
      return Response.json({ erro: 'clienteId e transacoes[] obrigatórios' }, { status: 400 })
    }

    const dados = transacoes.map((t: any) => {
      const dt = new Date(t.data)
      const mes = dt.getMonth() + 1
      const ano = dt.getFullYear()
      const tipo = String(t.tipo || 'despesa').toLowerCase().trim()
      const grupoConta = t.cartao ? 'pessoal_cartao' : 'pessoal_banco'
      return {
        clienteId,
        tipo,
        descricao: String(t.descricao || '').trim(),
        favorecido: String(t.descricao || '').trim(),
        planoConta: String(t.categoria || 'Outros').trim(),
        grupoConta,
        tipoContabil: t.cartao ? String(t.cartao).trim() : '',
        valor: tipo === 'despesa' ? -Math.abs(parseFloat(t.valor)) : Math.abs(parseFloat(t.valor)),
        data: dt,
        mes,
        ano,
        observacoes: t.observacoes ? String(t.observacoes) : null,
      }
    })

    await prisma.lancamentoManual.createMany({ data: dados })
    return Response.json({ ok: true, total: dados.length }, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
