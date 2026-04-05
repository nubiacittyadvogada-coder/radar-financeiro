export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border p-8 md:p-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Política de Privacidade</h1>
          <p className="text-sm text-gray-500 mt-1">Radar Financeiro — em conformidade com a LGPD (Lei nº 13.709/2018)</p>
          <p className="text-sm text-gray-500">última atualização: abril de 2026</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6 text-sm text-green-800">
          <strong>Resumo simples:</strong> Seus dados financeiros são seus. Não vendemos, não compartilhamos com terceiros para publicidade e não acessamos seus dados além do necessário para o serviço funcionar.
        </div>

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">1. Controlador dos Dados</h2>
            <p>O controlador dos dados pessoais coletados nesta Plataforma é o Radar Financeiro, com contato disponível em <strong>privacidade@radarfinanceiro.com.br</strong>.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">2. Dados que Coletamos</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse mt-2">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Dado</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Finalidade</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Base Legal (LGPD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ['Nome e e-mail', 'Criar e identificar sua conta', 'Art. 7º, V — execução de contrato'],
                    ['Senha (hash criptografado)', 'Autenticação segura', 'Art. 7º, V — execução de contrato'],
                    ['Dados financeiros importados', 'Prestar o serviço de gestão financeira', 'Art. 7º, V — execução de contrato'],
                    ['Logs de acesso (IP, data/hora)', 'Segurança e prevenção a fraudes', 'Art. 7º, IX — legítimo interesse'],
                    ['Cookies de sessão', 'Manter você autenticado', 'Art. 7º, V — execução de contrato'],
                  ].map(([dado, fin, base], i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="border border-gray-200 px-3 py-2 font-medium">{dado}</td>
                      <td className="border border-gray-200 px-3 py-2">{fin}</td>
                      <td className="border border-gray-200 px-3 py-2 text-gray-500">{base}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">3. O que NÃO fazemos</h2>
            <ul className="space-y-1.5">
              {[
                '❌ Não vendemos seus dados para anunciantes ou terceiros',
                '❌ Não usamos seus dados financeiros para treinamento de IA sem seu consentimento explícito',
                '❌ Não armazenamos senhas em texto plano (usamos bcrypt com salt)',
                '❌ Não compartilhamos informações pessoais identificáveis com parceiros comerciais',
                '❌ Não enviamos e-mails de marketing sem opção de descadastro',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="flex-shrink-0">{item.split(' ')[0]}</span>
                  <span>{item.split(' ').slice(1).join(' ')}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">4. Armazenamento e Segurança</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Dados armazenados em banco de dados PostgreSQL com acesso restrito;</li>
              <li>Comunicação protegida por HTTPS/TLS;</li>
              <li>Tokens JWT com expiração de 7 dias;</li>
              <li>Senhas criptografadas com bcrypt (custo 12);</li>
              <li>Backups automáticos com retenção de 30 dias.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">5. Compartilhamento de Dados</h2>
            <p>Seus dados são compartilhados apenas com os seguintes subprocessadores, estritamente para funcionamento da Plataforma:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Neon (Neon Inc.)</strong> — banco de dados em nuvem (EUA, SCCs aplicadas)</li>
              <li><strong>Vercel Inc.</strong> — hospedagem da aplicação (EUA, SCCs aplicadas)</li>
              <li><strong>Anthropic</strong> — processamento de linguagem natural para Conselheira IA (apenas o texto enviado pelo usuário, sem dados bancários identificáveis)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">6. Seus Direitos (LGPD — Art. 18)</h2>
            <p className="mb-2">Como titular dos dados, você tem direito a:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                ['🔍 Acesso', 'Confirmar a existência e acessar seus dados'],
                ['✏️ Correção', 'Corrigir dados incompletos ou desatualizados'],
                ['🗑️ Exclusão', 'Solicitar a exclusão de dados desnecessários'],
                ['📦 Portabilidade', 'Receber seus dados em formato estruturado'],
                ['🚫 Oposição', 'Opor-se a tratamento baseado em legítimo interesse'],
                ['📋 Informação', 'Saber com quem compartilhamos seus dados'],
              ].map(([titulo, desc], i) => (
                <div key={i} className="flex gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="flex-shrink-0">{titulo.split(' ')[0]}</span>
                  <div>
                    <div className="font-medium text-gray-800">{titulo.split(' ').slice(1).join(' ')}</div>
                    <div className="text-xs text-gray-500">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3">Para exercer seus direitos: <strong>privacidade@radarfinanceiro.com.br</strong>. Respondemos em até 15 dias.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">7. Retenção de Dados</h2>
            <p>Seus dados são mantidos enquanto sua conta estiver ativa. Ao solicitar exclusão da conta, os dados são removidos em até 30 dias, exceto obrigações legais que exijam retenção por prazo maior.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">8. Cookies</h2>
            <p>Utilizamos apenas cookies estritamente necessários para autenticação e segurança da sessão. Não utilizamos cookies de rastreamento ou publicidade.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">9. Menores de Idade</h2>
            <p>A Plataforma não se destina a menores de 18 anos. Não coletamos dados de menores de forma intencional.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">10. Alterações nesta Política</h2>
            <p>Eventuais alterações serão comunicadas por e-mail com 15 dias de antecedência. O uso continuado após a vigência das mudanças implica concordância.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">11. Encarregado (DPO)</h2>
            <p>Nosso encarregado de dados pode ser contatado em: <strong>privacidade@radarfinanceiro.com.br</strong></p>
          </section>

        </div>

        <div className="mt-8 pt-6 border-t flex gap-4 text-sm">
          <a href="/termos" className="text-blue-600 hover:underline">Termos de Uso</a>
          <a href="/login" className="text-gray-500 hover:underline">← Voltar ao login</a>
        </div>
      </div>
    </div>
  )
}
