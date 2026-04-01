import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed...')

  // Limpar dados existentes (em ordem de dependências)
  await prisma.conversaIA.deleteMany()
  await prisma.alerta.deleteMany()
  await prisma.lancamento.deleteMany()
  await prisma.importacao.deleteMany()
  await prisma.fechamento.deleteMany()
  await prisma.cliente.deleteMany()
  await prisma.usuarioBpo.deleteMany()
  await prisma.bpo.deleteMany()

  const senhaHash = await bcrypt.hash('radar123', 12)

  // Criar BPO de demonstração
  const bpo = await prisma.bpo.create({
    data: {
      nome: 'Núbia Citty BPO Financeiro',
      email: 'bpo@radarfinanceiro.com',
      senhaHash,
      telefone: '(31) 99999-0001',
      plano: 'profissional',
    },
  })
  console.log(`BPO criado: ${bpo.nome} (${bpo.email})`)

  // Criar usuário operador do BPO
  const operador = await prisma.usuarioBpo.create({
    data: {
      bpoId: bpo.id,
      nome: 'Operador Demo',
      email: 'operador@radarfinanceiro.com',
      senhaHash,
      role: 'operador',
    },
  })
  console.log(`Operador BPO criado: ${operador.nome} (${operador.email})`)

  // Criar cliente teste (escritório de advocacia)
  const cliente = await prisma.cliente.create({
    data: {
      bpoId: bpo.id,
      nomeEmpresa: 'NC Advogados',
      cnpj: '12.345.678/0001-90',
      setor: 'Advocacia',
      responsavel: 'Núbia Citty',
      telefone: '(31) 99999-0002',
      email: 'cliente@radarfinanceiro.com',
      senhaHash,
      alertaWpp: false,
      metaLucro: 20000,
      metaReceita: 100000,
    },
  })
  console.log(`Cliente criado: ${cliente.nomeEmpresa} (${cliente.email})`)

  console.log('\n=== Seed concluído ===')
  console.log('Logins disponíveis (senha: radar123):')
  console.log(`  BPO:      bpo@radarfinanceiro.com`)
  console.log(`  Operador: operador@radarfinanceiro.com`)
  console.log(`  Cliente:  cliente@radarfinanceiro.com`)
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
