/**
 * POST /api/v2/empresa/devedores/sincronizar-asaas
 * Verifica no Asaas o status atual de todas as cobranças com asaasPaymentId.
 * Marca como 'pago' no Radar as que foram pagas no Asaas.
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import { getAsaasClient } from '@/lib/asaas'
import prisma from '@/server/lib/db'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    if (!conta.asaasApiKey) {
      return Response.json({ erro: 'API Key do Asaas não configurada' }, { status: 400 })
    }

    const asaas = getAsaasClient(conta.asaasApiKey)

    // Busca todas as cobranças pendentes que têm ID no Asaas
    const cobrancas = await prisma.cobrancaDevedor.findMany({
      where: {
        status: 'pendente',
        asaasPaymentId: { not: null },
        clienteDevedor: { contaEmpresaId: conta.id },
      },
      select: { id: true, asaasPaymentId: true, valor: true },
    })

    let atualizadas = 0

    for (const cobranca of cobrancas) {
      try {
        const pagamento = await asaas.buscarCobranca(cobranca.asaasPaymentId!)
        if (pagamento.status === 'RECEIVED' || pagamento.status === 'CONFIRMED') {
          await prisma.cobrancaDevedor.update({
            where: { id: cobranca.id },
            data: {
              status: 'pago',
              pagoEm: pagamento.paymentDate ? new Date(pagamento.paymentDate) : new Date(),
              valorPago: pagamento.value || cobranca.valor,
            },
          })
          atualizadas++
        }
      } catch {
        // Continua para a próxima cobrança se falhar em uma
      }
    }

    // Recalcula totalDevido e totalPago de todos os devedores afetados
    if (atualizadas > 0) {
      const devedores = await prisma.clienteDevedor.findMany({
        where: { contaEmpresaId: conta.id },
        include: { cobrancas: true },
      })
      for (const d of devedores) {
        const totalDevido = d.cobrancas
          .filter(c => c.status === 'pendente')
          .reduce((s, c) => s + Number(c.valor), 0)
        const totalPago = d.cobrancas
          .filter(c => c.status === 'pago')
          .reduce((s, c) => s + Number(c.valorPago || c.valor), 0)
        await prisma.clienteDevedor.update({
          where: { id: d.id },
          data: { totalDevido, totalPago },
        })
      }
    }

    return Response.json({
      ok: true,
      verificadas: cobrancas.length,
      atualizadas,
      mensagem: atualizadas > 0
        ? `${atualizadas} cobrança(s) marcada(s) como paga.`
        : 'Nenhuma cobrança nova paga encontrada.',
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
