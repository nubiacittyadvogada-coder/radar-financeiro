/**
 * Cron: roda diariamente às 9h para cobrar automaticamente todos os devedores em atraso.
 * Dispara mensagem WhatsApp personalizada com link de pagamento PIX.
 * Configurar no Vercel Cron: "0 12 * * *" (9h Brasília = 12h UTC)
 */

import { NextRequest } from 'next/server'
import prisma from '@/server/lib/db'
import { executarReguaCobranca } from '@/lib/agenteCobranca'

export const maxDuration = 120

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return Response.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    // Busca todas as empresas com integração de cobrança ativa (Z-API configurado)
    const empresas = await prisma.contaEmpresa.findMany({
      where: {
        zapiInstanceId: { not: null },
        zapiToken: { not: null },
      },
    })

    let totalEmpresas = 0
    let totalEnviados = 0
    let totalErros = 0

    for (const empresa of empresas) {
      try {
        const resultados = await executarReguaCobranca(empresa.id)
        const enviados = resultados.filter(r => r.enviado).length
        totalEnviados += enviados
        totalErros += resultados.length - enviados
        if (resultados.length > 0) totalEmpresas++
      } catch (err: any) {
        console.error(`[Cron Cobrança] Erro empresa ${empresa.id}:`, err.message)
        totalErros++
      }
    }

    console.log(`[Cron Cobrança] ${totalEmpresas} empresa(s), ${totalEnviados} cobrança(s) enviada(s), ${totalErros} erro(s)`)

    return Response.json({
      ok: true,
      empresas: totalEmpresas,
      enviados: totalEnviados,
      erros: totalErros,
    })
  } catch (err: any) {
    console.error('[Cron Cobrança] Erro geral:', err.message)
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
