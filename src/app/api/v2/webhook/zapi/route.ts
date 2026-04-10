/**
 * Webhook Z-API — recebe mensagens enviadas pelos devedores via WhatsApp.
 * Configurar no painel Z-API: Webhooks → URL de recebimento → On Message Received
 * URL: https://radar-financeiro-roan.vercel.app/api/v2/webhook/zapi
 */

import { NextRequest } from 'next/server'
import prisma from '@/server/lib/db'
import { processarMensagemDevedor } from '@/lib/agenteConversacional'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Z-API envia fromMe=true para mensagens enviadas pela instância — ignora
    if (body.fromMe === true) {
      return Response.json({ ok: true, ignorado: 'fromMe' })
    }

    // Só processa mensagens de texto
    const texto = body.text?.message || body.message || ''
    if (!texto) {
      return Response.json({ ok: true, ignorado: 'sem texto' })
    }

    // Identifica a empresa pelo instanceId da instância Z-API
    const instanceId = body.instanceId || body.instancesId || ''
    if (!instanceId) {
      return Response.json({ ok: true, ignorado: 'sem instanceId' })
    }

    const conta = await prisma.contaEmpresa.findFirst({
      where: { zapiInstanceId: instanceId },
    })

    if (!conta) {
      return Response.json({ ok: true, ignorado: 'empresa não encontrada' })
    }

    // Telefone do remetente (ex: "5531999096712@c.us" → "5531999096712")
    const telefone = (body.phone || '').replace('@c.us', '').replace(/\D/g, '')
    if (!telefone) {
      return Response.json({ ok: true, ignorado: 'sem telefone' })
    }

    // Não processa mensagens do próprio número de alerta
    if (conta.telefoneAlerta && telefone === conta.telefoneAlerta.replace(/\D/g, '')) {
      return Response.json({ ok: true, ignorado: 'proprio numero' })
    }

    console.log(`[Webhook ZApi] Mensagem de ${telefone}: "${texto.substring(0, 80)}"`)

    // Processa em background (não bloqueia o webhook)
    processarMensagemDevedor(conta as any, telefone, texto).catch((err) => {
      console.error('[Webhook ZApi] Erro ao processar mensagem:', err)
    })

    return Response.json({ ok: true })
  } catch (err: any) {
    console.error('[Webhook ZApi] Erro:', err.message)
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

// Z-API faz GET para validar o webhook
export async function GET() {
  return Response.json({ ok: true, webhook: 'radar-financeiro' })
}
