/**
 * Cron: roda diariamente às 8h para enviar lembrete aos devedores
 * cujas cobranças vencem em 3 dias. Previne inadimplência.
 * Configurar no Vercel Cron: "0 11 * * *" (8h Brasília = 11h UTC)
 */

import { NextRequest } from 'next/server'
import prisma from '@/server/lib/db'
import { getZApiClient } from '@/lib/zapi'

export const maxDuration = 60

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return Response.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    // Cobranças que vencem em exatamente 3 dias
    const em3dias = new Date(hoje)
    em3dias.setDate(em3dias.getDate() + 3)
    const em4dias = new Date(hoje)
    em4dias.setDate(em4dias.getDate() + 4)

    const cobrancas = await prisma.cobrancaDevedor.findMany({
      where: {
        status: 'pendente',
        vencimento: { gte: em3dias, lt: em4dias },
      },
      include: {
        clienteDevedor: {
          include: { contaEmpresa: true },
        },
      },
    })

    let totalEnviados = 0

    for (const cobranca of cobrancas) {
      const { clienteDevedor } = cobranca
      const { contaEmpresa } = clienteDevedor

      if (!clienteDevedor.telefone) continue

      const zapi = getZApiClient(contaEmpresa)
      if (!zapi) continue

      const dataVenc = new Date(cobranca.vencimento).toLocaleDateString('pt-BR')
      const linkParte = cobranca.asaasLink
        ? `\n\nPague de forma rápida pelo link:\n${cobranca.asaasLink}`
        : ''

      const mensagem = `Olá, ${clienteDevedor.nome}! 👋\n\n` +
        `Passando para lembrar que a parcela *"${cobranca.descricao}"* no valor de *${fmt(Number(cobranca.valor))}* ` +
        `vence no dia *${dataVenc}*.\n\n` +
        `Evite encargos e regularize antes do vencimento!${linkParte}\n\n` +
        `Qualquer dúvida, estamos à disposição.`

      const enviado = await zapi.enviarTexto(clienteDevedor.telefone, mensagem)

      if (enviado) {
        totalEnviados++
        await prisma.mensagemCobranca.create({
          data: {
            clienteDevedorId: clienteDevedor.id,
            cobrancaId: cobranca.id,
            direcao: 'enviada',
            canal: 'whatsapp',
            conteudo: mensagem,
            enviado: true,
          },
        })
      }
    }

    console.log(`[Cron Lembrete] ${totalEnviados} lembrete(s) pré-vencimento enviado(s)`)

    return Response.json({
      ok: true,
      cobrancasEncontradas: cobrancas.length,
      lembreteEnviados: totalEnviados,
    })
  } catch (err: any) {
    console.error('[Cron Lembrete] Erro:', err.message)
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
