/**
 * PATCH /api/v2/empresa/contas/[id] — edita valor, vencimento, descricao, fornecedor, categoria
 * DELETE /api/v2/empresa/contas/[id] — exclui conta
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const registro = await prisma.contaPagarEmpresa.findFirst({
      where: { id: params.id, contaEmpresaId: conta.id },
    })
    if (!registro) return Response.json({ erro: 'Conta a pagar não encontrada' }, { status: 404 })

    const body = await req.json()
    const { descricao, fornecedor, valor, vencimento, categoria, observacoes } = body

    const atualizado = await prisma.contaPagarEmpresa.update({
      where: { id: params.id },
      data: {
        ...(descricao !== undefined && { descricao: String(descricao).trim() }),
        ...(fornecedor !== undefined && { fornecedor: fornecedor ? String(fornecedor).trim() : null }),
        ...(valor !== undefined && { valor: Number(valor) }),
        ...(vencimento !== undefined && { vencimento: new Date(vencimento) }),
        ...(categoria !== undefined && { categoria: categoria || null }),
        ...(observacoes !== undefined && { observacoes: observacoes || null }),
      },
    })

    return Response.json(atualizado)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const registro = await prisma.contaPagarEmpresa.findFirst({
      where: { id: params.id, contaEmpresaId: conta.id },
    })
    if (!registro) return Response.json({ erro: 'Conta a pagar não encontrada' }, { status: 404 })

    await prisma.contaPagarEmpresa.delete({ where: { id: params.id } })
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
