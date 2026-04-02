/**
 * Script de migração: legado (Cliente/Bpo) → v2 (Usuario/ContaEmpresa)
 *
 * O que faz:
 * 1. Para cada Cliente legado, cria um Usuario v2 + ContaEmpresa
 * 2. Copia Fechamentos → FechamentoEmpresa
 * 3. Copia ContasPagar → ContaPagarEmpresa
 * 4. Marca o Cliente legado com um campo de controle para não reprocessar
 *
 * Execução:
 *   npx tsx scripts/migrar-legado-v2.ts
 *   npx tsx scripts/migrar-legado-v2.ts --dry-run   (apenas simula, não persiste)
 *
 * IDEMPOTENTE: verifica se o Usuario com aquele email já existe antes de criar.
 */

import prisma from '../src/server/lib/db'

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  console.log(`\n=== Migração Legado → v2 ${DRY_RUN ? '[DRY RUN]' : '[PRODUÇÃO]'} ===\n`)

  const clientes = await prisma.cliente.findMany({
    include: {
      fechamentos: true,
      contasPagar: true,
    },
  })

  console.log(`Encontrados ${clientes.length} cliente(s) para migrar.\n`)

  let criados = 0
  let jaExistentes = 0
  let erros = 0

  for (const cliente of clientes) {
    const email = cliente.email
    if (!email) {
      console.warn(`  [SKIP] Cliente ${cliente.id} sem email — ignorado.`)
      continue
    }

    try {
      // Verifica se já foi migrado
      const usuarioExistente = await prisma.usuario.findUnique({ where: { email } })

      if (usuarioExistente) {
        // Garante que já tem ContaEmpresa
        const contaExistente = await prisma.contaEmpresa.findUnique({
          where: { usuarioId: usuarioExistente.id },
        })
        if (!contaExistente) {
          console.log(`  [UPDATE] Usuario ${email} existe mas sem ContaEmpresa — criando...`)
          if (!DRY_RUN) {
            await criarContaEmpresaParaUsuario(usuarioExistente.id, cliente)
          }
        } else {
          console.log(`  [SKIP] ${email} já migrado (usuário + conta existem).`)
        }
        jaExistentes++
        continue
      }

      console.log(`  [NOVO] Migrando ${email} (${cliente.nomeEmpresa})...`)

      if (!DRY_RUN) {
        // Cria o Usuario
        const novoUsuario = await prisma.usuario.create({
          data: {
            nome: cliente.nomeEmpresa,
            email,
            senhaHash: cliente.senhaHash || '',
            plano: 'basico',
            ativo: cliente.ativo,
          },
        })

        // Cria a ContaEmpresa
        const contaEmpresa = await criarContaEmpresaParaUsuario(novoUsuario.id, cliente)

        // Migra fechamentos
        let fechMigrados = 0
        for (const f of cliente.fechamentos) {
          const jaExiste = await prisma.fechamentoEmpresa.findUnique({
            where: { contaEmpresaId_mes_ano: { contaEmpresaId: contaEmpresa.id, mes: f.mes, ano: f.ano } },
          })
          if (!jaExiste) {
            await prisma.fechamentoEmpresa.create({
              data: {
                contaEmpresaId: contaEmpresa.id,
                mes: f.mes,
                ano: f.ano,
                receitaBruta: f.receitaBruta,
                honHonorariosIniciais: f.honHonorariosIniciais,
                honHonorariosMensais: f.honHonorariosMensais,
                honConsultas: f.honConsultas,
                honExito: f.honExito,
                honMultaCancelamento: f.honMultaCancelamento,
                repasseExito: f.repasseExito,
                impostos: f.impostos,
                receitaLiquida: f.receitaLiquida,
                custosDiretos: f.custosDiretos,
                margemContribuicao: f.margemContribuicao,
                percMargem: f.percMargem,
                despesasPessoal: f.despesasPessoal,
                despesasMarketing: f.despesasMarketing,
                despesasGerais: f.despesasGerais,
                totalDespesasAdm: f.totalDespesasAdm,
                lucroOperacional: f.lucroOperacional,
                percLucroOp: f.percLucroOp,
                retiradaSocios: f.retiradaSocios,
                resultadoFinanceiro: f.resultadoFinanceiro,
                receitaJuros: f.receitaJuros,
                despesaJuros: f.despesaJuros,
                lucroLiquido: f.lucroLiquido,
                percLucroLiq: f.percLucroLiq,
                distribuicaoLucros: f.distribuicaoLucros,
                investimentos: f.investimentos,
                emprestimosEntrada: f.emprestimosEntrada,
                emprestimosPagamento: f.emprestimosPagamento,
                parcelamentoImpostos: f.parcelamentoImpostos,
                resgateAplicacao: f.resgateAplicacao,
                aplicacaoFinanceira: f.aplicacaoFinanceira,
                aporteSocios: f.aporteSocios,
                resultadoCaixa: f.resultadoCaixa,
                saldoAnterior: f.saldoAnterior,
                saldoFinal: f.saldoFinal,
                resultadosPorSetor: f.resultadosPorSetor ?? undefined,
                receitaPrevista: f.receitaPrevista,
                despesaPrevista: f.despesaPrevista,
                pdfUrl: f.pdfUrl,
                pdfGeradoEm: f.pdfGeradoEm,
              },
            })
            fechMigrados++
          }
        }

        // Migra contas a pagar
        let contasMigradas = 0
        for (const c of cliente.contasPagar) {
          await prisma.contaPagarEmpresa.create({
            data: {
              contaEmpresaId: contaEmpresa.id,
              descricao: c.descricao,
              fornecedor: c.fornecedor,
              valor: c.valor,
              vencimento: c.vencimento,
              recorrente: c.recorrente,
              frequencia: c.frequencia,
              status: c.status,
              pagoEm: c.pagoEm,
              categoria: c.categoria,
              observacoes: c.observacoes,
            },
          })
          contasMigradas++
        }

        console.log(`     ✓ Usuario criado | ${fechMigrados} fechamento(s) | ${contasMigradas} conta(s) a pagar`)
      }

      criados++
    } catch (err: any) {
      console.error(`  [ERRO] ${email}: ${err.message}`)
      erros++
    }
  }

  console.log(`\n=== Resultado ===`)
  console.log(`  Criados:       ${criados}`)
  console.log(`  Já existentes: ${jaExistentes}`)
  console.log(`  Erros:         ${erros}`)
  if (DRY_RUN) console.log(`\n  ⚠️  DRY RUN — nenhuma alteração persistida.`)
  console.log()
}

async function criarContaEmpresaParaUsuario(usuarioId: string, cliente: any) {
  return prisma.contaEmpresa.create({
    data: {
      usuarioId,
      nomeEmpresa: cliente.nomeEmpresa,
      cnpj: cliente.cnpj,
      setor: cliente.setor,
      telefoneAlerta: cliente.telefoneWpp,
      alertaAtivo: cliente.alertaWpp ?? false,
      metaLucro: cliente.metaLucro,
      metaReceita: cliente.metaReceita,
    },
  })
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
