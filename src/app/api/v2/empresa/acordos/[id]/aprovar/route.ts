import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import { getZApiClient } from '@/lib/zapi'
import prisma from '@/server/lib/db'

// POST /api/v2/empresa/acordos/[id]/aprovar — aprova ou rejeita um acordo pendente
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    // Verifica que o acordo pertence a esta empresa
    const acordo = await prisma.acordoCobranca.findFirst({
      where: {
        id: params.id,
        status: 'aguardando_aprovacao',
        clienteDevedor: { contaEmpresaId: conta.id },
      },
      include: {
        clienteDevedor: { select: { id: true, nome: true, telefone: true } },
        cobranca: true,
      },
    })

    if (!acordo) return Response.json({ erro: 'Acordo não encontrado' }, { status: 404 })

    const { decisao } = await req.json() // 'aprovar' | 'rejeitar'
    if (!['aprovar', 'rejeitar'].includes(decisao)) {
      return Response.json({ erro: 'decisao deve ser "aprovar" ou "rejeitar"' }, { status: 400 })
    }

    const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    const zapi = getZApiClient(conta)
    const telefone = acordo.clienteDevedor.telefone

    if (decisao === 'aprovar') {
      await prisma.acordoCobranca.update({
        where: { id: acordo.id },
        data: { status: 'aceito', aprovadoPor: 'usuario', aprovadoEm: new Date() },
      })

      // Envia a mensagem que a IA havia preparado
      if (telefone && zapi && acordo.mensagemProposta) {
        await zapi.enviarTexto(telefone, acordo.mensagemProposta)
        await prisma.mensagemCobranca.create({
          data: {
            clienteDevedorId: acordo.clienteDevedorId,
            cobrancaId: acordo.cobrancaId,
            direcao: 'enviada',
            canal: 'whatsapp',
            conteudo: acordo.mensagemProposta,
            enviado: true,
          },
        })
      } else if (telefone && zapi) {
        // Mensagem genérica se não tinha proposta salva
        const desconto = Math.round((1 - Number(acordo.valorAcordado) / Number(acordo.valorOriginal)) * 100)
        const msg = `${acordo.clienteDevedor.nome}, ótima notícia! Aprovamos sua proposta. ` +
          `Valor acordado: *${fmt(Number(acordo.valorAcordado))}* em ${acordo.parcelas}x` +
          (desconto > 0 ? ` (${desconto}% de desconto)` : '') +
          `.\n\nEm breve enviaremos o link de pagamento. Obrigado! 🙏`
        await zapi.enviarTexto(telefone, msg)
        await prisma.mensagemCobranca.create({
          data: {
            clienteDevedorId: acordo.clienteDevedorId,
            cobrancaId: acordo.cobrancaId,
            direcao: 'enviada',
            canal: 'whatsapp',
            conteudo: msg,
            enviado: true,
          },
        })
      }

      return Response.json({ ok: true, acao: 'aprovado' })
    }

    // Rejeitar
    await prisma.acordoCobranca.update({
      where: { id: acordo.id },
      data: { status: 'recusado', aprovadoPor: 'usuario', aprovadoEm: new Date() },
    })

    if (telefone && zapi) {
      const msg = `${acordo.clienteDevedor.nome}, infelizmente não conseguimos aprovar essa condição no momento. ` +
        `Entre em contato conosco para conversarmos sobre outras alternativas. 🙏`
      await zapi.enviarTexto(telefone, msg)
      await prisma.mensagemCobranca.create({
        data: {
          clienteDevedorId: acordo.clienteDevedorId,
          cobrancaId: acordo.cobrancaId,
          direcao: 'enviada',
          canal: 'whatsapp',
          conteudo: msg,
          enviado: true,
        },
      })
    }

    return Response.json({ ok: true, acao: 'recusado' })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
