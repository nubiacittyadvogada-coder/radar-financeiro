import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

// GET /api/v2/empresa/lancamentos?mes=X&ano=Y
export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const mes = Number(searchParams.get('mes') || new Date().getMonth() + 1)
    const ano = Number(searchParams.get('ano') || new Date().getFullYear())

    const lancamentos = await prisma.lancamentoEmpresa.findMany({
      where: { contaEmpresaId: conta.id, mes, ano },
      orderBy: { criadoEm: 'desc' },
    })

    return Response.json(lancamentos)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

// POST /api/v2/empresa/lancamentos
export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const body = await req.json()
    const data = body.data ? new Date(body.data) : new Date()
    const mes = data.getMonth() + 1
    const ano = data.getFullYear()

    const lancamento = await prisma.lancamentoEmpresa.create({
      data: {
        contaEmpresaId: conta.id,
        origem: 'manual',
        mes,
        ano,
        tipo: body.tipo,
        subtipo: body.subtipo || null,
        planoConta: body.planoConta || body.tipo,
        grupoConta: body.grupoConta || (body.tipo === 'receita' ? 'Receitas' : 'Despesas'),
        favorecido: body.favorecido || null,
        descricao: body.descricao || null,
        valor: body.valor,
        dataCompetencia: data,
        dataVencimento: body.dataVencimento ? new Date(body.dataVencimento) : null,
        statusPg: body.pago ? 'pago' : 'pendente',
        dataPagamento: body.pago ? data : null,
        formaPagamento: body.formaPagamento || null,
        observacoes: body.observacoes || null,
        previsto: false,
      },
    })

    return Response.json(lancamento, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

// DELETE /api/v2/empresa/lancamentos?id=X
export async function DELETE(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return Response.json({ erro: 'ID obrigatório' }, { status: 400 })

    // Verifica ownership e que é manual
    const lanc = await prisma.lancamentoEmpresa.findFirst({
      where: { id, contaEmpresaId: conta.id, origem: 'manual' },
    })
    if (!lanc) return Response.json({ erro: 'Lançamento não encontrado' }, { status: 404 })

    await prisma.lancamentoEmpresa.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
