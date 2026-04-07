/**
 * POST /api/v2/empresa/devedores/sincronizar-asaas
 * Sincroniza status de cobranças com o Asaas:
 * - RECEIVED/CONFIRMED → marca como 'pago'
 * - DELETED/CANCELLED ou não encontrado → marca como 'cancelado'
 * - Devedores sem nenhuma cobrança pendente → marca ativo=false
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
      select: { id: true, asaasPaymentId: true, valor: true, clienteDevedorId: true },
    })

    let pagas = 0
    let canceladas = 0

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
          pagas++
        } else if (pagamento.status === 'DELETED' || pagamento.status === 'REFUNDED' || pagamento.deleted === true) {
          await prisma.cobrancaDevedor.update({
            where: { id: cobranca.id },
            data: { status: 'cancelado' },
          })
          canceladas++
        }
      } catch {
        // Se a API retornar 404 ou erro, a cobrança foi excluída no Asaas
        await prisma.cobrancaDevedor.update({
          where: { id: cobranca.id },
          data: { status: 'cancelado' },
        }).catch(() => {})
        canceladas++
      }
    }

    // Recalcula totais e desativa devedores sem cobranças pendentes
    const devedores = await prisma.clienteDevedor.findMany({
      where: { contaEmpresaId: conta.id },
      include: { cobrancas: true },
    })

    let desativados = 0
    for (const d of devedores) {
      const totalDevido = d.cobrancas
        .filter(c => c.status === 'pendente')
        .reduce((s, c) => s + Number(c.valor), 0)
      const totalPago = d.cobrancas
        .filter(c => c.status === 'pago')
        .reduce((s, c) => s + Number(c.valorPago || c.valor), 0)
      const temPendente = d.cobrancas.some(c => c.status === 'pendente')

      await prisma.clienteDevedor.update({
        where: { id: d.id },
        data: {
          totalDevido,
          totalPago,
          ativo: temPendente,
        },
      })
      if (!temPendente && d.ativo) desativados++
    }

    const partes = []
    if (pagas > 0) partes.push(`${pagas} paga(s)`)
    if (canceladas > 0) partes.push(`${canceladas} excluída(s) do Asaas`)
    if (desativados > 0) partes.push(`${desativados} devedor(es) quitado(s)`)

    return Response.json({
      ok: true,
      verificadas: cobrancas.length,
      pagas,
      canceladas,
      desativados,
      mensagem: partes.length > 0
        ? `Sincronizado: ${partes.join(', ')}.`
        : 'Tudo já estava atualizado.',
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
