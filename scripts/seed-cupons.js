const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Cupom de trial 30 dias - Pro
  await prisma.cupomDesconto.upsert({
    where: { codigo: 'TESTE30' },
    update: {},
    create: {
      codigo: 'TESTE30',
      descricao: '30 dias grátis no plano Pro',
      tipo: 'trial',
      valor: 0,
      diasTrial: 30,
      planoAlvo: 'pro',
      ativo: true,
      usoMax: null, // ilimitado
    },
  })

  // Cupom de trial 30 dias - Premium
  await prisma.cupomDesconto.upsert({
    where: { codigo: 'PREMIUM30' },
    update: {},
    create: {
      codigo: 'PREMIUM30',
      descricao: '30 dias grátis no plano Premium',
      tipo: 'trial',
      valor: 0,
      diasTrial: 30,
      planoAlvo: 'premium',
      ativo: true,
      usoMax: 50, // limitado a 50 usos
    },
  })

  console.log('Cupons criados: TESTE30 e PREMIUM30')
}

main().catch(console.error).finally(() => prisma.$disconnect())
