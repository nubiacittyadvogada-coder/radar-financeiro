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

    console.log('[Webhook ZApi] Payload recebido:', JSON.stringify(body).substring(0, 500))

    // Z-API envia fromMe=true para mensagens enviadas pela instância — ignora
    if (body.fromMe === true) {
      return Response.json({ ok: true, ignorado: 'fromMe' })
    }

    // Extrai texto de diferentes tipos de mensagem
    let texto = body.text?.message || body.message?.text || body.message || ''

    // Se é áudio/imagem/documento sem texto, gera um placeholder para o agente responder
    if (!texto && (body.audio || body.voice || body.type === 'audio')) {
      texto = '[Áudio recebido — o devedor enviou uma mensagem de voz]'
    }
    if (!texto && (body.image || body.type === 'image')) {
      texto = '[Imagem recebida]'
    }
    if (!texto && (body.document || body.type === 'document')) {
      texto = '[Documento recebido]'
    }

    // Se é um objeto, tenta extrair string
    if (typeof texto === 'object') {
      texto = texto.message || texto.text || texto.body || JSON.stringify(texto)
    }

    if (!texto) {
      console.log('[Webhook ZApi] Ignorado: sem conteúdo processável. Tipo:', body.type)
      return Response.json({ ok: true, ignorado: 'sem texto' })
    }

    // Identifica a empresa pelo instanceId da instância Z-API
    const instanceId = body.instanceId || body.instancesId || ''

    let conta: any = null

    if (instanceId) {
      conta = await prisma.contaEmpresa.findFirst({
        where: { zapiInstanceId: instanceId },
      })
    }

    // Fallback: busca qualquer empresa com Z-API configurado (para instância única)
    if (!conta) {
      conta = await prisma.contaEmpresa.findFirst({
        where: {
          zapiInstanceId: { not: null },
          zapiToken: { not: null },
        },
      })
    }

    if (!conta) {
      console.log('[Webhook ZApi] Nenhuma empresa encontrada para instanceId:', instanceId)
      return Response.json({ ok: true, ignorado: 'empresa não encontrada' })
    }

    // Telefone do remetente — tenta vários campos do Z-API
    const rawPhone = body.phone || body.from || body.chatId || body.sender || ''
    const telefone = String(rawPhone).replace('@c.us', '').replace('@s.whatsapp.net', '').replace(/\D/g, '')
    if (!telefone) {
      console.log('[Webhook ZApi] Sem telefone no payload')
      return Response.json({ ok: true, ignorado: 'sem telefone' })
    }

    // Não processa mensagens do próprio número de alerta
    if (conta.telefoneAlerta && telefone === conta.telefoneAlerta.replace(/\D/g, '')) {
      return Response.json({ ok: true, ignorado: 'proprio numero' })
    }

    console.log(`[Webhook ZApi] Processando mensagem de ${telefone} (empresa: ${conta.nomeEmpresa}): "${String(texto).substring(0, 80)}"`)

    // Processa em background (não bloqueia o webhook)
    processarMensagemDevedor(conta as any, telefone, String(texto)).catch((err) => {
      console.error('[Webhook ZApi] Erro ao processar mensagem:', err)
    })

    return Response.json({ ok: true })
  } catch (err: any) {
    console.error('[Webhook ZApi] Erro geral:', err.message, err.stack)
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

// Z-API faz GET para validar o webhook
export async function GET() {
  return Response.json({ ok: true, webhook: 'radar-financeiro' })
}
