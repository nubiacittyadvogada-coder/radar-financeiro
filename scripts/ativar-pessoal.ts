import prisma from '../src/server/lib/db'

async function main() {
  const u = await prisma.usuario.findUnique({ where: { email: 'nubiacittyadvogada@gmail.com' } })
  if (!u) { console.log('Usuário não encontrado'); return }

  await prisma.contaPessoal.upsert({
    where: { usuarioId: u.id },
    update: {},
    create: { usuarioId: u.id },
  })

  console.log('✅ Modo Pessoal ativado! Faça logout e login novamente.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
