import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import { AsaasClient } from '@/lib/asaas'
import prisma from '@/server/lib/db'

// GET — prévia dos inadimplentes no Asaas (sem salvar)
export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
    if (!conta?.asaasApiKey) return Response.json({ erro: 'Chave Asaas não configurada. Vá em Configurações da Empresa.' }, { status: 400 })

    const asaas = new AsaasClient(conta.asaasApiKey)

    // Busca cobranças vencidas no Asaas
    const pagamentos = await asaas.listarInadimplentes()

    // Agrupa por cliente
    const porCliente: Record<string, { cliente: any; cobrancas: any[] }> = {}
    for (const p of pagamentos) {
      const cid = p.customer
      if (!porCliente[cid]) porCliente[cid] = { cliente: null, cobrancas: [] }
      porCliente[cid].cobrancas.push(p)
    }

    // Busca dados dos clientes
    const clienteIds = Object.keys(porCliente)
    for (const cid of clienteIds) {
      try {
        const cli = await asaas.buscarClientePorId(cid)
        porCliente[cid].cliente = cli
      } catch {}
    }

    const resultado = Object.values(porCliente).map(({ cliente, cobrancas }) => ({
      asaasCustomerId: cobrancas[0]?.customer,
      nome: cliente?.name || 'Desconhecido',
      cpfCnpj: cliente?.cpfCnpj || null,
      email: cliente?.email || null,
      telefone: cliente?.mobilePhone || null,
      totalDevido: cobrancas.reduce((s: number, c: any) => s + Number(c.value), 0),
      cobrancas: cobrancas.map((c: any) => ({
        asaasId: c.id,
        descricao: c.description || 'Cobrança Asaas',
        valor: Number(c.value),
        vencimento: c.dueDate,
        status: c.status,
        invoiceUrl: c.invoiceUrl || null,
      })),
    }))

    return Response.json(resultado)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

// POST — importa os inadimplentes para o app
export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
    if (!conta?.asaasApiKey) return Response.json({ erro: 'Chave Asaas não configurada.' }, { status: 400 })

    const body = await req.json()
    const clientes: any[] = body.clientes // array da prévia GET

    let importados = 0
    let jaExistiam = 0

    for (const cli of clientes) {
      // Verifica se já existe pelo asaasCustomerId ou cpfCnpj
      let devedor = await prisma.clienteDevedor.findFirst({
        where: {
          contaEmpresaId: conta.id,
          OR: [
            ...(cli.asaasCustomerId ? [{ asaasCustomerId: cli.asaasCustomerId }] : []),
            ...(cli.cpfCnpj ? [{ cpfCnpj: cli.cpfCnpj }] : []),
          ],
        },
      })

      if (!devedor) {
        devedor = await prisma.clienteDevedor.create({
          data: {
            contaEmpresaId: conta.id,
            nome: cli.nome,
            cpfCnpj: cli.cpfCnpj || null,
            email: cli.email || null,
            telefone: cli.telefone || null,
            asaasCustomerId: cli.asaasCustomerId || null,
            perfilDevedor: 'primeiro_atraso',
            totalDevido: cli.totalDevido,
          },
        })
        importados++
      } else {
        // Atualiza o total devedor
        await prisma.clienteDevedor.update({
          where: { id: devedor.id },
          data: { totalDevido: cli.totalDevido, asaasCustomerId: cli.asaasCustomerId || devedor.asaasCustomerId },
        })
        jaExistiam++
      }

      // Importa cobranças que ainda não existem
      for (const cob of cli.cobrancas) {
        const jaExiste = await prisma.cobrancaDevedor.findFirst({
          where: { clienteDevedorId: devedor.id, asaasPaymentId: cob.asaasId },
        })
        if (!jaExiste) {
          await prisma.cobrancaDevedor.create({
            data: {
              clienteDevedorId: devedor.id,
              descricao: cob.descricao,
              valor: cob.valor,
              vencimento: new Date(cob.vencimento),
              asaasPaymentId: cob.asaasId,
              asaasLink: cob.invoiceUrl || null,
              status: 'pendente',
            },
          })
        }
      }
    }

    return Response.json({ ok: true, importados, atualizados: jaExistiam })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
