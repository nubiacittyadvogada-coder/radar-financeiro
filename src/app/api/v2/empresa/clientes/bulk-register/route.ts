/**
 * POST /api/v2/empresa/clientes/bulk-register
 * Cadastra ou atualiza em lote clientes/parceiros/funcionários na tabela ClienteDevedor.
 * Usado para pré-registrar CPFs de repasse antes da importação do OFX.
 *
 * Body: { clientes: [{ nome, cpfCnpj, tipoVinculo }] }
 * tipoVinculo: 'cliente' | 'parceiro' | 'funcionario'
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

interface ClienteInput {
  nome: string
  cpfCnpj: string
  tipoVinculo?: string
}

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const body = await req.json()
    const { clientes } = body as { clientes: ClienteInput[] }

    if (!Array.isArray(clientes) || clientes.length === 0) {
      return Response.json({ erro: 'clientes[] obrigatório' }, { status: 400 })
    }

    const tiposValidos = ['cliente', 'parceiro', 'funcionario']
    const criados: string[] = []
    const atualizados: string[] = []
    const erros: string[] = []

    for (const c of clientes) {
      const cpfCnpj = (c.cpfCnpj || '').replace(/\D/g, '')
      const nome = (c.nome || '').trim()
      const tipoVinculo = tiposValidos.includes(c.tipoVinculo || '') ? c.tipoVinculo! : 'cliente'

      if (!nome) { erros.push(`CPF ${cpfCnpj}: nome obrigatório`); continue }
      if (!cpfCnpj) { erros.push(`${nome}: cpfCnpj obrigatório`); continue }

      try {
        const existente = await prisma.clienteDevedor.findFirst({
          where: { contaEmpresaId: conta.id, cpfCnpj },
        })

        if (existente) {
          await prisma.clienteDevedor.update({
            where: { id: existente.id },
            data: { nome, tipoVinculo },
          })
          atualizados.push(nome)
        } else {
          await prisma.clienteDevedor.create({
            data: {
              contaEmpresaId: conta.id,
              nome,
              cpfCnpj,
              tipoVinculo,
            },
          })
          criados.push(nome)
        }
      } catch (e: any) {
        erros.push(`${nome}: ${e.message}`)
      }
    }

    return Response.json({
      ok: true,
      criados: criados.length,
      atualizados: atualizados.length,
      erros,
      detalhes: { criados, atualizados },
    }, { status: 201 })
  } catch (err: any) {
    console.error('[bulk-register]', err.message)
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
