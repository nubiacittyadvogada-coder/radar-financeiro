/**
 * GET    /api/v2/empresa/clientes/[id] — detalhe do cliente com cobranças e lançamentos
 * PATCH  /api/v2/empresa/clientes/[id] — atualiza dados do cliente
 * DELETE /api/v2/empresa/clientes/[id] — desativa o cliente
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import { AsaasClient } from '@/lib/asaas'
import prisma from '@/server/lib/db'

type Params = { params: { id: string } }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const cliente = await prisma.clienteDevedor.findFirst({
      where: { id: params.id, contaEmpresaId: conta.id },
      include: {
        cobrancas: {
          orderBy: { vencimento: 'desc' },
          take: 30,
        },
        mensagens: {
          orderBy: { criadoEm: 'desc' },
          take: 10,
        },
        acordos: {
          orderBy: { criadoEm: 'desc' },
          take: 5,
        },
      },
    })

    if (!cliente) return Response.json({ erro: 'Cliente não encontrado' }, { status: 404 })

    // Lançamentos relacionados (repasses / receitas deste cliente)
    const lancamentos = await prisma.lancamentoEmpresa.findMany({
      where: {
        contaEmpresaId: conta.id,
        OR: [
          ...(cliente.nome ? [{ favorecido: { contains: cliente.nome.split(' ')[0], mode: 'insensitive' as const } }] : []),
          ...(cliente.cpfCnpj ? [{ descricao: { contains: cliente.cpfCnpj } }] : []),
        ],
      },
      orderBy: { dataCompetencia: 'desc' },
      take: 20,
      select: {
        id: true, planoConta: true, tipo: true, subtipo: true,
        valor: true, dataCompetencia: true, statusPg: true,
        descricao: true, origem: true, previsto: true,
      },
    })

    // Cobranças do Asaas (tempo real) — apenas se tiver asaasCustomerId e chave configurada
    let cobrancasAsaas: any[] = []
    if (cliente.asaasCustomerId && conta.asaasApiKey) {
      try {
        const asaas = new AsaasClient(conta.asaasApiKey)
        cobrancasAsaas = await asaas.listarCobrancasClienteTodas(cliente.asaasCustomerId)
      } catch {}
    }

    return Response.json({ ...cliente, lancamentos, cobrancasAsaas })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const cliente = await prisma.clienteDevedor.findFirst({
      where: { id: params.id, contaEmpresaId: conta.id },
    })
    if (!cliente) return Response.json({ erro: 'Cliente não encontrado' }, { status: 404 })

    const body = await req.json()
    const { nome, cpfCnpj, email, telefone, tipoVinculo } = body

    const cpf = cpfCnpj ? cpfCnpj.replace(/\D/g, '') : cliente.cpfCnpj

    const atualizado = await prisma.clienteDevedor.update({
      where: { id: params.id },
      data: {
        nome: nome?.trim() || cliente.nome,
        cpfCnpj: cpf || null,
        email: email?.trim() || cliente.email,
        telefone: telefone?.replace(/\D/g, '') || cliente.telefone,
        tipoVinculo: tipoVinculo || cliente.tipoVinculo,
      },
    })

    // Atualiza no Asaas se estiver vinculado
    if (cliente.asaasCustomerId && conta.asaasApiKey) {
      try {
        const asaas = new AsaasClient(conta.asaasApiKey)
        await asaas.atualizarCliente(cliente.asaasCustomerId, {
          name: nome?.trim() || cliente.nome,
          email: email?.trim() || undefined,
          mobilePhone: telefone?.replace(/\D/g, '') || undefined,
        })
      } catch {}
    }

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

    const cliente = await prisma.clienteDevedor.findFirst({
      where: { id: params.id, contaEmpresaId: conta.id },
    })
    if (!cliente) return Response.json({ erro: 'Cliente não encontrado' }, { status: 404 })

    await prisma.clienteDevedor.update({
      where: { id: params.id },
      data: { ativo: false },
    })

    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
