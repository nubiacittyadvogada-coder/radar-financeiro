/**
 * POST /api/v2/empresa/zapi/diagnostico
 * Diagnóstico completo do Z-API — testa AMBAS as instâncias (Jurídico e Cobrança).
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

    const resultado: any = {}

    // ── Instância Jurídico ─────────────────────────────────────────────────
    const zapiJuridico = getZApiClient(conta, 'juridico')
    resultado.juridico = {
      instanceId: conta.zapiInstanceId || null,
      configurado: !!zapiJuridico,
    }
    if (zapiJuridico) {
      resultado.juridico.status = await zapiJuridico.consultarStatus()
      resultado.juridico.webhookAtual = await zapiJuridico.consultarWebhookRecebimento()
      if (conta.telefoneAlerta) {
        const msgTeste = `🔍 *Diagnóstico Radar — Instância JURÍDICO*\n\nTeste enviado em ${new Date().toLocaleTimeString('pt-BR')}. Envio funcionando!`
        resultado.juridico.testeEnvio = await zapiJuridico.enviarTextoDetalhado(conta.telefoneAlerta, msgTeste)
      }
    }

    // ── Instância Cobrança ─────────────────────────────────────────────────
    // Se não há instância separada de cobrança, usa fallback para jurídico
    const temInstanciaCobrancaSeparada = !!(
      conta.zapiInstanceIdCobranca &&
      conta.zapiTokenCobranca &&
      conta.zapiClientTokenCobranca
    )
    const zapiCobranca = getZApiClient(conta, 'cobranca')

    resultado.cobranca = {
      instanceId: temInstanciaCobrancaSeparada ? conta.zapiInstanceIdCobranca : conta.zapiInstanceId,
      configurado: !!zapiCobranca,
      usandoFallbackJuridico: !temInstanciaCobrancaSeparada,
    }

    if (zapiCobranca) {
      resultado.cobranca.status = await zapiCobranca.consultarStatus()
      if (conta.telefoneAlerta) {
        const msgTeste = `🔍 *Diagnóstico Radar — Instância COBRANÇA*\n\nTeste enviado em ${new Date().toLocaleTimeString('pt-BR')}. Esta é a instância que envia cobranças para os devedores!`
        resultado.cobranca.testeEnvio = await zapiCobranca.enviarTextoDetalhado(conta.telefoneAlerta, msgTeste)
      }
    }

    // ── Últimas mensagens recebidas via webhook ────────────────────────────
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

    // ── Últimas cobranças enviadas ─────────────────────────────────────────
    const ultimasCobranças = await prisma.mensagemCobranca.findMany({
      where: {
        clienteDevedor: { contaEmpresaId: conta.id },
        direcao: 'enviada',
      },
      orderBy: { criadoEm: 'desc' },
      take: 5,
      include: { clienteDevedor: { select: { nome: true } } },
    })
    resultado.ultimasCobrancasEnviadas = ultimasCobranças.map(m => ({
      criadoEm: m.criadoEm,
      devedor: m.clienteDevedor.nome,
      enviado: m.enviado,
      trecho: m.conteudo.substring(0, 80),
    }))

    return Response.json(resultado)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
