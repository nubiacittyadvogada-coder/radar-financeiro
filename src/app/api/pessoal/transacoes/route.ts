import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const sp = new URL(req.url).searchParams
    const clienteId = sp.get('clienteId')
    const mes = sp.get('mes') ? parseInt(sp.get('mes')!) : undefined
    const ano = sp.get('ano') ? parseInt(sp.get('ano')!) : undefined

    if (!clienteId) return Response.json({ erro: 'clienteId obrigatório' }, { status: 400 })

    const where: any = {
      clienteId,
      grupoConta: { startsWith: 'pessoal' },
    }
    if (mes) where.mes = mes
    if (ano) where.ano = ano

    const transacoes = await prisma.lancamentoManual.findMany({
      where,
      orderBy: { data: 'desc' },
    })

    // Stats
    const receitas = transacoes.filter(t => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0)
    const despesas = transacoes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + Number(t.valor), 0)
    const cartao = transacoes.filter(t => t.grupoConta === 'pessoal_cartao').reduce((s, t) => s + Number(t.valor), 0)

    // Gastos por categoria
    const porCategoria: Record<string, number> = {}
    transacoes.filter(t => t.tipo === 'despesa').forEach(t => {
      porCategoria[t.planoConta] = (porCategoria[t.planoConta] || 0) + Number(t.valor)
    })

    // Gastos por cartão
    const porCartao: Record<string, number> = {}
    transacoes.filter(t => t.grupoConta === 'pessoal_cartao').forEach(t => {
      const cartaoNome = t.tipoContabil || 'Sem cartão'
      porCartao[cartaoNome] = (porCartao[cartaoNome] || 0) + Number(t.valor)
    })

    return Response.json({ transacoes, stats: { receitas, despesas, saldo: receitas - despesas, cartao, porCategoria, porCartao } })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    const { clienteId, tipo, descricao, valor, data, categoria, cartao, observacoes } = body

    if (!clienteId || !tipo || !descricao || !valor || !data) {
      return Response.json({ erro: 'Campos obrigatórios: clienteId, tipo, descricao, valor, data' }, { status: 400 })
    }

    const dt = new Date(data)
    const mes = dt.getMonth() + 1
    const ano = dt.getFullYear()

    const grupoConta = cartao ? 'pessoal_cartao' : 'pessoal_banco'

    const t = await prisma.lancamentoManual.create({
      data: {
        clienteId,
        tipo,
        descricao,
        favorecido: descricao,
        planoConta: categoria || 'Outros',
        grupoConta,
        tipoContabil: cartao || '',
        valor: tipo === 'despesa' ? -Math.abs(parseFloat(valor)) : Math.abs(parseFloat(valor)),
        data: dt,
        mes,
        ano,
        observacoes: observacoes || null,
      },
    })

    return Response.json(t, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
