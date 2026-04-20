/**
 * GET  /api/v2/empresa/clientes — lista clientes/parceiros/funcionários
 * POST /api/v2/empresa/clientes — cria novo cliente
 *
 * Query params GET: busca, tipoVinculo, page, limit
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const busca = searchParams.get('busca')?.trim() || ''
    const tipoVinculo = searchParams.get('tipoVinculo') || ''
    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const limit = Math.min(100, Number(searchParams.get('limit') || '50'))
    const skip = (page - 1) * limit

    const where: any = {
      contaEmpresaId: conta.id,
      ativo: true,
    }

    if (busca) {
      where.OR = [
        { nome: { contains: busca, mode: 'insensitive' } },
        { cpfCnpj: { contains: busca } },
        { email: { contains: busca, mode: 'insensitive' } },
      ]
    }

    if (tipoVinculo) {
      where.tipoVinculo = tipoVinculo
    }

    const [clientes, total] = await Promise.all([
      prisma.clienteDevedor.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ totalDevido: 'desc' }, { nome: 'asc' }],
        include: {
          _count: { select: { cobrancas: true, mensagens: true } },
        },
      }),
      prisma.clienteDevedor.count({ where }),
    ])

    // Estatísticas gerais
    const stats = await prisma.clienteDevedor.groupBy({
      by: ['tipoVinculo'],
      where: { contaEmpresaId: conta.id, ativo: true },
      _count: true,
    })

    return Response.json({
      clientes,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        total: stats.reduce((s, g) => s + g._count, 0),
        porTipo: Object.fromEntries(stats.map(g => [g.tipoVinculo, g._count])),
        comAsaas: await prisma.clienteDevedor.count({
          where: { contaEmpresaId: conta.id, ativo: true, asaasCustomerId: { not: null } },
        }),
      },
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const body = await req.json()
    const { nome, cpfCnpj, email, telefone, tipoVinculo } = body

    if (!nome?.trim()) return Response.json({ erro: 'Nome obrigatório' }, { status: 400 })

    const cpf = cpfCnpj ? cpfCnpj.replace(/\D/g, '') : null

    // Verifica duplicata
    if (cpf) {
      const existe = await prisma.clienteDevedor.findFirst({
        where: { contaEmpresaId: conta.id, cpfCnpj: cpf, ativo: true },
      })
      if (existe) return Response.json({ erro: `CPF/CNPJ já cadastrado: ${existe.nome}` }, { status: 409 })
    }

    const cliente = await prisma.clienteDevedor.create({
      data: {
        contaEmpresaId: conta.id,
        nome: nome.trim(),
        cpfCnpj: cpf || null,
        email: email?.trim() || null,
        telefone: telefone?.replace(/\D/g, '') || null,
        tipoVinculo: tipoVinculo || 'cliente',
      },
    })

    return Response.json(cliente, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
