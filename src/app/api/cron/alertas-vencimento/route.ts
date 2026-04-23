/**
 * Cron: roda diariamente para avisar sobre contas que vencem hoje.
 * Configurar no Vercel Cron: "0 8 * * *" (8h todo dia)
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
  // Verifica secret para segurança
  const authHeader = req.headers.get('authorization')
  const secret = authHeader?.replace('Bearer ', '') || req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return Response.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const amanha = new Date(hoje)
  amanha.setDate(amanha.getDate() + 1)

  try {
    // Busca todas as contas que vencem hoje (v2 - ContaEmpresa)
    const contasHoje = await prisma.contaPagarEmpresa.findMany({
      where: {
        status: 'pendente',
        vencimento: { gte: hoje, lt: amanha },
      },
      include: { contaEmpresa: true },
    })

    // Agrupa por empresa
    const porEmpresa = new Map<string, { conta: any; contas: any[] }>()
    for (const c of contasHoje) {
      const key = c.contaEmpresaId
      if (!porEmpresa.has(key)) {
        porEmpresa.set(key, { conta: c.contaEmpresa, contas: [] })
      }
      porEmpresa.get(key)!.contas.push(c)
    }

    let totalEnviados = 0

    for (const [, { conta, contas }] of porEmpresa) {
      if (!conta.alertaAtivo || !conta.telefoneAlerta) continue

      const total = contas.reduce((s: number, c: any) => s + Number(c.valor), 0)
      const lista = contas.map((c: any) => `• ${c.descricao} — ${fmt(c.valor)}`).join('\n')

      const mensagem = `🔔 *Radar Financeiro — Vencimentos hoje (${dataBR(hoje)})*

${conta.nomeEmpresa}, você tem ${contas.length} conta(s) vencendo hoje:

${lista}

*Total: ${fmt(total)}*

Acesse o sistema para gerenciar suas contas.`

      let enviado = false
      // Tenta Z-API da empresa primeiro
      if (conta.zapiInstanceId && conta.zapiToken && conta.zapiClientToken) {
        const zapi = new ZApiClient(conta.zapiInstanceId, conta.zapiToken, conta.zapiClientToken)
        enviado = await zapi.enviarTexto(conta.telefoneAlerta, mensagem)
      }
      // Fallback: Z-API do sistema
      if (!enviado) {
        enviado = await enviarWhatsAppSistema(conta.telefoneAlerta, mensagem)
      }

      if (enviado) {
        totalEnviados++
        await prisma.alertaEmpresa.create({
          data: {
            contaEmpresaId: conta.id,
            tipo: 'vencimento',
            titulo: `${contas.length} conta(s) vencendo hoje`,
            mensagem,
            canal: 'whatsapp',
            enviado: true,
            enviadoEm: new Date(),
          },
        })
      }
    }

    return Response.json({ ok: true, empresasNotificadas: totalEnviados, contasHoje: contasHoje.length })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
