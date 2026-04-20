/**
 * Cron: roda diariamente às 9h para cobrar automaticamente todos os devedores em atraso.
 * Regras:
 *  - 1-4 dias em atraso: executarReguaCobranca (tom amigável/direto via IA, intervalo 3 dias)
 *  - 5+ dias em atraso: alerta interno para Núbia/Brendha via telefoneAlerta
 * Configurar no Vercel Cron: "0 12 * * *" (9h Brasília = 12h UTC)
 */

import { NextRequest } from 'next/server'
import prisma from '@/server/lib/db'
import { executarReguaCobranca } from '@/lib/agenteCobranca'
import { getZApiClient } from '@/lib/zapi'

export const maxDuration = 120

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return Response.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const empresas = await prisma.contaEmpresa.findMany({
      where: {
        zapiInstanceId: { not: null },
        zapiToken: { not: null },
      },
    })

    let totalEmpresas = 0
    let totalEnviados = 0
    let totalErros = 0
    let totalAlertasInternos = 0

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    for (const empresa of empresas) {
      try {
        // ── Régua de cobrança para todos os atrasados ──────────────────────
        const resultados = await executarReguaCobranca(empresa.id)
        const enviados = resultados.filter(r => r.enviado).length
        totalEnviados += enviados
        totalErros += resultados.length - enviados
        if (resultados.length > 0) totalEmpresas++

        // ── Alerta interno: cobranças com 5+ dias em atraso ────────────────
        if (!empresa.telefoneAlerta || !empresa.alertaAtivo) continue

        // Alerta interno para Núbia → instância jurídica
        const zapi = getZApiClient(empresa, 'juridico')
        if (!zapi) continue

        const limite5dias = new Date(hoje)
        limite5dias.setDate(limite5dias.getDate() - 5)

        const atrasadas5dias = await prisma.cobrancaDevedor.findMany({
          where: {
            clienteDevedor: { contaEmpresaId: empresa.id },
            status: 'pendente',
            vencimento: { lte: limite5dias },
          },
          include: { clienteDevedor: true },
        })

        if (atrasadas5dias.length === 0) continue

        // Monta mensagem de alerta interno agrupada
        const linhas = atrasadas5dias.map(c => {
          const diasAtraso = Math.floor(
            (hoje.getTime() - new Date(c.vencimento).getTime()) / (1000 * 60 * 60 * 24)
          )
          return `• ${c.clienteDevedor.nome} | ${fmt(Number(c.valor))} | ${diasAtraso} dias`
        })

        const totalInadimplente = atrasadas5dias.reduce((s, c) => s + Number(c.valor), 0)

        const mensagemInterna =
          `⚠️ *HONORÁRIOS EM ATRASO — ${empresa.nomeEmpresa}*\n\n` +
          `${atrasadas5dias.length} cliente(s) com 5+ dias sem pagamento:\n\n` +
          linhas.join('\n') +
          `\n\n*Total inadimplente: ${fmt(totalInadimplente)}*\n` +
          `_Acesse o Radar Financeiro → Clientes para agir._`

        const enviado = await zapi.enviarTexto(empresa.telefoneAlerta, mensagemInterna)

        if (enviado) {
          totalAlertasInternos++
          // Registra como alerta no sistema
          await prisma.alertaEmpresa.create({
            data: {
              contaEmpresaId: empresa.id,
              tipo: 'inadimplencia',
              titulo: `${atrasadas5dias.length} cliente(s) com 5+ dias em atraso`,
              mensagem: mensagemInterna,
              canal: 'whatsapp',
              enviado: true,
              enviadoEm: new Date(),
            },
          })
        }
      } catch (err: any) {
        console.error(`[Cron Cobrança] Erro empresa ${empresa.id}:`, err.message)
        totalErros++
      }
    }

    console.log(
      `[Cron Cobrança] ${totalEmpresas} empresa(s), ` +
      `${totalEnviados} cobranças enviadas, ` +
      `${totalAlertasInternos} alertas internos, ` +
      `${totalErros} erro(s)`
    )

    return Response.json({
      ok: true,
      empresas: totalEmpresas,
      enviados: totalEnviados,
      alertasInternos: totalAlertasInternos,
      erros: totalErros,
    })
  } catch (err: any) {
    console.error('[Cron Cobrança] Erro geral:', err.message)
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
