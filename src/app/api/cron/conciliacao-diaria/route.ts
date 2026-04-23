/**
 * Cron: roda todo dia às 22h Brasília (01h UTC+next day).
 * Verifica pendências financeiras e alerta a empresa via WhatsApp SOMENTE quando há problemas.
 * Silêncio = tudo OK.
 *
 * Verifica:
 * 1. Pagamentos em espécie aguardando aprovação há mais de 24h
 * 2. Receitas OFX sem cliente identificado (não conciliadas)
 * 3. Cobranças Asaas pagas hoje sem lançamento correspondente
 */

import { NextRequest } from 'next/server'
import prisma from '@/server/lib/db'
import { getZApiClient } from '@/lib/zapi'

export const maxDuration = 60

function fmt(v: any) {
  return `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = authHeader?.replace('Bearer ', '') || req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return Response.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const agora = new Date()
  const limite24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000)
  const inicioHoje = new Date(agora)
  inicioHoje.setHours(0, 0, 0, 0)

  const resultados: Array<{ empresa: string; alertado: boolean; pendencias: number }> = []

  try {
    // Busca todas as empresas com alertas ativos e Z-API configurada
    const contas = await prisma.contaEmpresa.findMany({
      where: {
        alertaAtivo: true,
        telefoneAlerta: { not: null },
        zapiInstanceId: { not: null },
        zapiToken: { not: null },
        zapiClientToken: { not: null },
      },
    })

    for (const conta of contas) {
      const pendencias: string[] = []

      // ── 1. Espécie pendente há mais de 24h ─────────────────────────────────
      const especiePendentes = await prisma.lancamentoEmpresa.findMany({
        where: {
          contaEmpresaId: conta.id,
          origem: 'especie',
          statusPg: 'pendente_aprovacao',
          criadoEm: { lt: limite24h },
        },
        select: { favorecido: true, valor: true, descricao: true },
      })

      if (especiePendentes.length > 0) {
        const totalEsp = especiePendentes.reduce((s, e) => s + Number(e.valor), 0)
        pendencias.push(
          `💵 *${especiePendentes.length} pagamento(s) em espécie* aguardando confirmação há mais de 24h (total: ${fmt(totalEsp)}):\n` +
          especiePendentes.slice(0, 3).map(e => `  • ${e.favorecido} — ${fmt(e.valor)} — ${e.descricao}`).join('\n') +
          (especiePendentes.length > 3 ? `\n  ... e mais ${especiePendentes.length - 3}` : '')
        )
      }

      // ── 2. Receitas OFX recentes sem cliente identificado ─────────────────
      const ofxSemCliente = await prisma.lancamentoEmpresa.findMany({
        where: {
          contaEmpresaId: conta.id,
          origem: 'ofx_sicredi',
          tipo: 'receita',
          conciliado: false,
          criadoEm: { gte: new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { favorecido: true, valor: true, dataCompetencia: true },
        take: 5,
      })

      if (ofxSemCliente.length > 0) {
        const totalOfx = ofxSemCliente.reduce((s, e) => s + Number(e.valor), 0)
        pendencias.push(
          `🏦 *${ofxSemCliente.length} crédito(s) Sicredi* não conciliados nos últimos 7 dias (total: ${fmt(totalOfx)}):\n` +
          ofxSemCliente.slice(0, 3).map(e =>
            `  • ${e.favorecido || 'desconhecido'} — ${fmt(e.valor)} — ${e.dataCompetencia ? new Date(e.dataCompetencia).toLocaleDateString('pt-BR') : ''}`
          ).join('\n') +
          (ofxSemCliente.length > 3 ? `\n  ... e mais ${ofxSemCliente.length - 3}` : '')
        )
      }

      // ── 3. Cobranças Asaas pagas hoje (resumo positivo, só informa se > 0) ─
      const cobrancasPagasHoje = await prisma.cobrancaDevedor.findMany({
        where: {
          clienteDevedor: { contaEmpresaId: conta.id },
          status: 'pago',
          pagoEm: { gte: inicioHoje },
        },
        select: { valor: true, clienteDevedor: { select: { nome: true } } },
      })

      // Salva registro de conciliação
      await prisma.conciliacaoDiaria.create({
        data: {
          contaEmpresaId: conta.id,
          data: agora,
          fonte: 'diaria',
          status: pendencias.length > 0 ? 'pendencias' : 'ok',
          totalLancamentos: especiePendentes.length + ofxSemCliente.length,
          totalConciliados: cobrancasPagasHoje.length,
          pendencias: pendencias.length,
          detalhesJson: pendencias.length > 0 ? JSON.stringify({ especiePendentes: especiePendentes.length, ofxSemCliente: ofxSemCliente.length }) : null,
        },
      })

      // Envia WhatsApp SOMENTE se há pendências
      if (pendencias.length > 0 && conta.telefoneAlerta) {
        const zapi = getZApiClient(conta)
        if (zapi) {
          const resumoAsaas = cobrancasPagasHoje.length > 0
            ? `\n✅ *${cobrancasPagasHoje.length} pagamento(s)* recebidos via Asaas hoje (${fmt(cobrancasPagasHoje.reduce((s, c) => s + Number(c.valor), 0))})`
            : ''

          const mensagem =
            `⚠️ *Conciliação Financeira — ${agora.toLocaleDateString('pt-BR')}*\n\n` +
            pendencias.join('\n\n') +
            resumoAsaas +
            `\n\n_Acesse o Radar Financeiro para resolver._`

          await zapi.enviarTexto(conta.telefoneAlerta, mensagem)
          resultados.push({ empresa: conta.nomeEmpresa, alertado: true, pendencias: pendencias.length })
        }
      } else {
        resultados.push({ empresa: conta.nomeEmpresa, alertado: false, pendencias: 0 })
      }
    }

    return Response.json({ ok: true, processados: contas.length, resultados })
  } catch (err: any) {
    console.error('[Cron conciliacao-diaria]', err.message)
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
