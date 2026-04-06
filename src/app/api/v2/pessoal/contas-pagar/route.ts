import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const tag = searchParams.get('tag')

    const contas = await prisma.contaPagarPessoal.findMany({
      where: {
        contaPessoalId: conta.id,
        ...(tag ? { tag } : {}),
      },
      orderBy: { vencimento: 'asc' },
    })

    // Atualiza status de atrasadas automaticamente
    const hoje = new Date()
    const atualizarAtrasadas = contas
      .filter(c => c.status === 'pendente' && c.vencimento && new Date(c.vencimento) < hoje)
      .map(c => prisma.contaPagarPessoal.update({ where: { id: c.id }, data: { status: 'atrasado' } }))
    if (atualizarAtrasadas.length > 0) await Promise.all(atualizarAtrasadas)

    const contasAtualizadas = await prisma.contaPagarPessoal.findMany({
      where: { contaPessoalId: conta.id, ...(tag ? { tag } : {}) },
      orderBy: { vencimento: 'asc' },
    })

    return Response.json(contasAtualizadas)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const body = await req.json()
    const { descricao, fornecedor, categoria, tag, valor, vencimento, observacoes } = body

    const nova = await prisma.contaPagarPessoal.create({
      data: {
        contaPessoalId: conta.id,
        descricao,
        fornecedor: fornecedor || null,
        categoria: categoria || null,
        tag: tag || null,
        valor,
        vencimento: vencimento ? new Date(vencimento) : null,
        observacoes: observacoes || null,
      },
    })

    return Response.json(nova, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return Response.json({ erro: 'ID obrigatório' }, { status: 400 })

    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    // Verifica que o registro pertence ao usuário logado antes de deletar
    const registro = await prisma.contaPagarPessoal.findFirst({
      where: { id, contaPessoalId: conta.id },
    })
    if (!registro) return Response.json({ erro: 'Não encontrado' }, { status: 404 })

    await prisma.contaPagarPessoal.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
