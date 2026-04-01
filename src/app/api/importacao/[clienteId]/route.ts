import { NextRequest } from 'next/server'
import { getUsuario, isBpo } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { processarDespesas, processarReceitas } from '@/server/lib/processarExcel'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { clienteId: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || !isBpo(u)) return Response.json({ erro: 'Acesso restrito ao BPO' }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get('arquivo') as File | null
    const tipo = formData.get('tipo') as string
    const mes = parseInt(formData.get('mes') as string)
    const ano = parseInt(formData.get('ano') as string)

    if (!file || !tipo || !mes || !ano) {
      return Response.json({ erro: 'arquivo, tipo, mes e ano são obrigatórios' }, { status: 400 })
    }

    if (!['receitas', 'despesas'].includes(tipo)) {
      return Response.json({ erro: 'Tipo deve ser "receitas" ou "despesas"' }, { status: 400 })
    }

    // Verifica que o cliente pertence ao BPO
    const cliente = await prisma.cliente.findFirst({ where: { id: params.clienteId, bpoId: u.bpoId! } })
    if (!cliente) return Response.json({ erro: 'Cliente não encontrado' }, { status: 404 })

    const buffer = Buffer.from(await file.arrayBuffer())

    // Salvar em /tmp para usar com processarDespesas/Receitas
    const tmpFile = join(tmpdir(), `import-${Date.now()}.xlsx`)
    writeFileSync(tmpFile, buffer)

    // Criar registro de importação
    const importacao = await prisma.importacao.create({
      data: { clienteId: params.clienteId, tipo, nomeArquivo: tmpFile, mes, ano, status: 'processando' },
    })

    let resultado
    if (tipo === 'despesas') {
      resultado = await processarDespesas(buffer, params.clienteId, mes, ano, importacao.id)
    } else {
      resultado = await processarReceitas(buffer, params.clienteId, mes, ano, importacao.id)
    }

    await prisma.importacao.update({ where: { id: importacao.id }, data: { status: 'concluido' } })

    return Response.json(resultado, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
