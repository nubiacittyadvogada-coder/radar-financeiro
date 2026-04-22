/**
 * POST /api/v2/empresa/zapi/diagnostico
 * Diagnóstico completo do Z-API:
 *  1. Status da instância (connected?)
 *  2. Webhook de recebimento configurado
 *  3. Teste de envio para o telefoneAlerta com resposta completa
 *  4. Últimos logs do webhook salvo no banco
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import { getZApiClient } from '@/lib/zapi'
import prisma from '@/server/lib/db'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const zapi = getZApiClient(conta, 'juridico')
    if (!zapi) {
      return Response.json({ erro: 'Z-API Jurídico não configurado.' }, { status: 400 })
    }

    const resultado: any = {
      instanciaId: conta.zapiInstanceId,
      webhookUrl: 'https://radar-financeiro-roan.vercel.app/api/v2/webhook/zapi',
    }

    // 1. Status da instância
    resultado.statusInstancia = await zapi.consultarStatus()

    // 2. Webhook configurado
    resultado.webhookAtual = await zapi.consultarWebhookRecebimento()

    // 3. Teste de envio (se tem telefoneAlerta)
    if (conta.telefoneAlerta) {
      const msgTeste = `🔍 *Diagnóstico Radar Financeiro*\n\nTeste enviado em ${new Date().toLocaleTimeString('pt-BR')}. Se recebeu esta mensagem, o envio está funcionando!`
      resultado.testeEnvio = await zapi.enviarTextoDetalhado(conta.telefoneAlerta, msgTeste)
    } else {
      resultado.testeEnvio = { ok: false, erro: 'telefoneAlerta não configurado' }
    }

    // 4. Últimos logs de webhook (alertas do tipo webhook_log)
    const logsWebhook = await prisma.alertaEmpresa.findMany({
      where: { contaEmpresaId: conta.id, tipo: 'webhook_log' },
      orderBy: { criadoEm: 'desc' },
      take: 5,
    })
    resultado.ultimosWebhooksRecebidos = logsWebhook.map(l => ({
      criadoEm: l.criadoEm,
      titulo: l.titulo,
      mensagem: l.mensagem.substring(0, 300),
    }))

    return Response.json(resultado)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
