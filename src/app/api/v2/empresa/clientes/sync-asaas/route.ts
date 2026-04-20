/**
 * POST /api/v2/empresa/clientes/sync-asaas
 * Importa todos os clientes do Asaas para o banco local (ClienteDevedor).
 * - Busca por asaasCustomerId ou cpfCnpj para evitar duplicatas
 * - Atualiza nome/email/telefone se já existe
 * - Não sobrescreve tipoVinculo já definido
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import { AsaasClient } from '@/lib/asaas'
import prisma from '@/server/lib/db'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })
    if (!conta.asaasApiKey) return Response.json({ erro: 'Chave Asaas não configurada. Configure em Configurações.' }, { status: 400 })

    const asaas = new AsaasClient(conta.asaasApiKey)

    // Busca todos os clientes do Asaas (paginado)
    const asaasClientes: any[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const res = await asaas.listarTodosClientes(100, offset)
      asaasClientes.push(...res.data)
      hasMore = res.hasMore && res.data.length === 100
      offset += 100
      if (offset > 2000) break // segurança
    }

    let criados = 0
    let atualizados = 0
    const erros: string[] = []

    for (const ac of asaasClientes) {
      try {
        const cpfCnpj = ac.cpfCnpj ? ac.cpfCnpj.replace(/\D/g, '') : null

        // Busca por asaasCustomerId ou cpfCnpj
        const existente = await prisma.clienteDevedor.findFirst({
          where: {
            contaEmpresaId: conta.id,
            OR: [
              { asaasCustomerId: ac.id },
              ...(cpfCnpj ? [{ cpfCnpj }] : []),
            ],
          },
        })

        if (existente) {
          await prisma.clienteDevedor.update({
            where: { id: existente.id },
            data: {
              asaasCustomerId: ac.id,
              nome: ac.name || existente.nome,
              email: ac.email || existente.email || null,
              telefone: ac.mobilePhone || existente.telefone || null,
              cpfCnpj: cpfCnpj || existente.cpfCnpj,
              ativo: true,
            },
          })
          atualizados++
        } else {
          await prisma.clienteDevedor.create({
            data: {
              contaEmpresaId: conta.id,
              nome: ac.name || 'Sem nome',
              cpfCnpj: cpfCnpj || null,
              email: ac.email || null,
              telefone: ac.mobilePhone || null,
              asaasCustomerId: ac.id,
              tipoVinculo: 'cliente',
            },
          })
          criados++
        }
      } catch (e: any) {
        erros.push(`${ac.name}: ${e.message}`)
      }
    }

    return Response.json({
      ok: true,
      totalAsaas: asaasClientes.length,
      criados,
      atualizados,
      erros,
    })
  } catch (err: any) {
    console.error('[sync-asaas clientes]', err.message)
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
