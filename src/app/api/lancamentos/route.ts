import { NextRequest } from 'next/server'
import { getUsuario, isBpo } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { classificar } from '@/server/lib/classificador'
import { calcularFechamento } from '@/server/lib/calcularFechamento'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const sp = new URL(req.url).searchParams
    const clienteId = u.tipo === 'cliente' ? u.id : sp.get('clienteId') || ''
    if (!clienteId) return Response.json({ erro: 'clienteId obrigatório' }, { status: 400 })

    const mes = sp.get('mes') ? Number(sp.get('mes')) : undefined
    const ano = sp.get('ano') ? Number(sp.get('ano')) : undefined

    const lancamentos = await prisma.lancamentoManual.findMany({
      where: { clienteId, ...(mes ? { mes } : {}), ...(ano ? { ano } : {}) },
      orderBy: { data: 'desc' },
    })

    return Response.json(lancamentos)
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

    const { tipo, descricao, favorecido, planoConta, valor, data, previsto, observacoes } = body
    if (!tipo || !descricao || !planoConta || !valor || !data) {
      return Response.json({ erro: 'Campos obrigatórios: tipo, descricao, planoConta, valor, data' }, { status: 400 })
    }

    let classificacao
    try { classificacao = classificar(planoConta) }
    catch { return Response.json({ erro: `Plano de contas inválido: ${planoConta}` }, { status: 400 }) }

    const dataObj = new Date(data)
    const mes = dataObj.getMonth() + 1
    const ano = dataObj.getFullYear()

    const lancamento = await prisma.lancamentoManual.create({
      data: {
        clienteId, tipo, descricao, favorecido: favorecido || null,
        planoConta, grupoConta: classificacao.grupoConta, tipoContabil: classificacao.tipo,
        valor: Math.abs(Number(valor)), data: dataObj, mes, ano,
        previsto: previsto || false, observacoes: observacoes || null,
      },
    })

    await calcularFechamento(clienteId, mes, ano)
    return Response.json(lancamento, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
