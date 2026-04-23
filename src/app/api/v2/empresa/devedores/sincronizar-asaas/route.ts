/**
 * POST /api/v2/empresa/devedores/sincronizar-asaas
 * Sincroniza status de cobranças com o Asaas:
 * - RECEIVED/CONFIRMED → marca como 'pago'
 * - DELETED/REFUNDED   → marca como 'cancelado'
 * - Devedores sem cobrança pendente → recalcula totais e marca ativo=false
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import { getAsaasClient } from '@/lib/asaas'
import prisma from '@/server/lib/db'

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

    // Busca cobranças pendentes que têm ID no Asaas
    const cobrancas = await prisma.cobrancaDevedor.findMany({
      where: {
        status: 'pendente',
        asaasPaymentId: { not: null },
        clienteDevedor: { contaEmpresaId: conta.id },
      },
      select: { id: true, asaasPaymentId: true, valor: true, clienteDevedorId: true },
    })

    // Consulta todas as cobranças no Asaas em paralelo (muito mais rápido)
    const resultados = await Promise.allSettled(
      cobrancas.map(c => asaas.buscarCobranca(c.asaasPaymentId!).then(p => ({ c, p })))
    )

    const updatesPagas: string[] = []
    const updatesCanceladas: string[] = []
    const pagasData: Record<string, { pagoEm: Date; valorPago: number }> = {}

    for (const r of resultados) {
      if (r.status === 'fulfilled') {
        const { c, p } = r.value
        if (p.status === 'RECEIVED' || p.status === 'CONFIRMED') {
          updatesPagas.push(c.id)
          pagasData[c.id] = {
            pagoEm: p.paymentDate ? new Date(p.paymentDate) : new Date(),
            valorPago: p.value ?? Number(c.valor),
          }
        } else if (p.status === 'DELETED' || p.status === 'REFUNDED' || p.deleted === true) {
          updatesCanceladas.push(c.id)
        }
      } else {
        // Erro ao consultar (ex: 404 = excluída no Asaas)
        const c = cobrancas[resultados.indexOf(r)]
        updatesCanceladas.push(c.id)
      }
    }

    // Atualiza banco em paralelo para cada cobrança paga/cancelada
    const dbOps = [
      ...updatesPagas.map(id =>
        prisma.cobrancaDevedor.update({
          where: { id },
          data: {
            status: 'pago',
            pagoEm: pagasData[id].pagoEm,
            valorPago: pagasData[id].valorPago,
          },
        })
      ),
      ...updatesCanceladas.map(id =>
        prisma.cobrancaDevedor.update({
          where: { id },
          data: { status: 'cancelado' },
        })
      ),
    ]

    if (dbOps.length > 0) {
      await Promise.allSettled(dbOps)
    }

    // Recalcula totais dos devedores afetados
    const devedoresAfetados = [
      ...new Set([
        ...updatesPagas.map(id => cobrancas.find(c => c.id === id)!.clienteDevedorId),
        ...updatesCanceladas.map(id => cobrancas.find(c => c.id === id)!.clienteDevedorId),
      ]),
    ]

    let desativados = 0

    if (devedoresAfetados.length > 0) {
      const devedores = await prisma.clienteDevedor.findMany({
        where: { id: { in: devedoresAfetados } },
        include: { cobrancas: { select: { status: true, valor: true, valorPago: true } } },
      })

      await Promise.allSettled(
        devedores.map(d => {
          const totalDevido = d.cobrancas
            .filter(c => c.status === 'pendente')
            .reduce((s, c) => s + Number(c.valor), 0)
          const totalPago = d.cobrancas
            .filter(c => c.status === 'pago')
            .reduce((s, c) => s + Number(c.valorPago ?? c.valor), 0)
          const temPendente = d.cobrancas.some(c => c.status === 'pendente')
          if (!temPendente && d.ativo) desativados++
          return prisma.clienteDevedor.update({
            where: { id: d.id },
            data: { totalDevido, totalPago, ativo: temPendente },
          })
        })
      )
    }

    const partes = []
    if (updatesPagas.length > 0) partes.push(`${updatesPagas.length} paga(s)`)
    if (updatesCanceladas.length > 0) partes.push(`${updatesCanceladas.length} excluída(s) do Asaas`)
    if (desativados > 0) partes.push(`${desativados} devedor(es) quitado(s)`)

    return Response.json({
      ok: true,
      verificadas: cobrancas.length,
      pagas: updatesPagas.length,
      canceladas: updatesCanceladas.length,
      desativados,
      mensagem: partes.length > 0
        ? `Sincronizado: ${partes.join(', ')}.`
        : cobrancas.length === 0
        ? 'Nenhuma cobrança Asaas pendente para verificar.'
        : 'Tudo já estava atualizado.',
    })
  } catch (err: any) {
    console.error('[sincronizar-asaas] Erro:', err.message)
    return Response.json({ erro: err.message || 'Erro interno' }, { status: 500 })
  }
}
