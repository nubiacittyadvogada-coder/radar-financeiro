/**
 * Cron: roda toda segunda-feira às 8h para enviar resumo semanal de pagamentos.
 * Configurar no Vercel Cron: "0 8 * * 1" (segunda-feira 8h)
 */

import { NextRequest } from 'next/server'
import prisma from '@/server/lib/db'
import { enviarWhatsAppSistema, ZApiClient } from '@/lib/zapi'

export const maxDuration = 60

function fmt(v: any) {
  return `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function dataBR(d: Date) {
  return d.toLocaleDateString('pt-BR')
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return Response.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const em7dias = new Date(hoje)
  em7dias.setDate(em7dias.getDate() + 7)

  try {
    // Busca contas que vencem nos próximos 7 dias (v2)
    const contasSemana = await prisma.contaPagarEmpresa.findMany({
      where: {
        status: 'pendente',
        vencimento: { gte: hoje, lte: em7dias },
      },
      include: { contaEmpresa: true },
      orderBy: { vencimento: 'asc' },
    })

    // Busca contas atrasadas
    const contasAtrasadas = await prisma.contaPagarEmpresa.findMany({
      where: {
        status: 'pendente',
        vencimento: { lt: hoje },
      },
      include: { contaEmpresa: true },
    })

    // Busca todas empresas com alerta ativo
    const todasEmpresas = await prisma.contaEmpresa.findMany({
      where: { alertaAtivo: true, telefoneAlerta: { not: null } },
    })

    // Agrupa contas por empresa
    const semanaMap = new Map<string, any[]>()
    const atrasadasMap = new Map<string, any[]>()
    for (const c of contasSemana) {
      if (!semanaMap.has(c.contaEmpresaId)) semanaMap.set(c.contaEmpresaId, [])
      semanaMap.get(c.contaEmpresaId)!.push(c)
    }
    for (const c of contasAtrasadas) {
      if (!atrasadasMap.has(c.contaEmpresaId)) atrasadasMap.set(c.contaEmpresaId, [])
      atrasadasMap.get(c.contaEmpresaId)!.push(c)
    }

    let totalEnviados = 0

    for (const conta of todasEmpresas) {
      const semana = semanaMap.get(conta.id) || []
      const atrasadas = atrasadasMap.get(conta.id) || []

      const totalSemana = semana.reduce((s: number, c: any) => s + Number(c.valor), 0)
      const totalAtrasadas = atrasadas.reduce((s: number, c: any) => s + Number(c.valor), 0)

      let mensagem = `📅 *Radar Financeiro — Resumo Semanal*\n*${conta.nomeEmpresa}*\n`

      if (atrasadas.length > 0) {
        mensagem += `\n⚠️ *${atrasadas.length} conta(s) ATRASADA(s) — ${fmt(totalAtrasadas)}*\n`
        mensagem += atrasadas.slice(0, 5).map((c: any) =>
          `• ${c.descricao} — ${fmt(c.valor)} (venc. ${dataBR(new Date(c.vencimento))})`
        ).join('\n')
        if (atrasadas.length > 5) mensagem += `\n... e mais ${atrasadas.length - 5}`
      }

      if (semana.length > 0) {
        mensagem += `\n\n📌 *Vencendo esta semana — ${fmt(totalSemana)}*\n`
        mensagem += semana.map((c: any) =>
          `• ${dataBR(new Date(c.vencimento))} — ${c.descricao} — ${fmt(c.valor)}`
        ).join('\n')
      }

      if (semana.length === 0 && atrasadas.length === 0) {
        mensagem += `\n\n✅ Nenhuma conta a pagar vencendo esta semana. Tudo em dia!`
      }

      mensagem += '\n\nAcesse o sistema para gerenciar seus pagamentos.'

      let enviado = false
      if (conta.zapiInstanceId && conta.zapiToken && conta.zapiClientToken) {
        const zapi = new ZApiClient(conta.zapiInstanceId, conta.zapiToken, conta.zapiClientToken)
        enviado = await zapi.enviarTexto(conta.telefoneAlerta, mensagem)
      }
      if (!enviado) {
        enviado = await enviarWhatsAppSistema(conta.telefoneAlerta, mensagem)
      }

      if (enviado) {
        totalEnviados++
        await prisma.alertaEmpresa.create({
          data: {
            contaEmpresaId: conta.id,
            tipo: 'resumo_semanal',
            titulo: `Resumo: ${semana.length} esta semana, ${atrasadas.length} atrasadas`,
            mensagem,
            canal: 'whatsapp',
            enviado: true,
            enviadoEm: new Date(),
          },
        })
      }
    }

    return Response.json({ ok: true, empresasNotificadas: totalEnviados })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
