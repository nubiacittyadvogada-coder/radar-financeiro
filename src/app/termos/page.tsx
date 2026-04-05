export default function TermosPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border p-8 md:p-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Termos de Uso</h1>
          <p className="text-sm text-gray-500 mt-1">Radar Financeiro — última atualização: abril de 2026</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-6 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">1. Aceitação dos Termos</h2>
            <p>Ao criar uma conta e utilizar o Radar Financeiro ("Plataforma"), você ("Usuário") concorda integralmente com estes Termos de Uso. Caso não concorde, não utilize a Plataforma.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">2. O que é o Radar Financeiro</h2>
            <p>O Radar Financeiro é uma plataforma SaaS de gestão financeira pessoal e empresarial. Permite ao Usuário importar extratos bancários, categorizar transações, acompanhar orçamentos, controlar parcelas, definir metas e obter análises por inteligência artificial.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">3. Cadastro e Conta</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>O cadastro é pessoal e intransferível.</li>
              <li>O Usuário é responsável pela confidencialidade da sua senha.</li>
              <li>É vedado compartilhar credenciais de acesso.</li>
              <li>Informações falsas no cadastro podem resultar em cancelamento da conta.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">4. Planos e Pagamentos</h2>
            <p>A Plataforma poderá oferecer planos gratuitos e pagos. Os planos pagos são cobrados de forma recorrente conforme a periodicidade contratada. O cancelamento pode ser solicitado a qualquer momento, com validade até o fim do período já pago.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">5. Uso Permitido</h2>
            <p>O Usuário se compromete a utilizar a Plataforma exclusivamente para fins lícitos, não podendo:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Realizar engenharia reversa, copiar ou redistribuir o software;</li>
              <li>Inserir dados de terceiros sem autorização;</li>
              <li>Utilizar scripts ou automações não autorizadas;</li>
              <li>Tentar acessar contas de outros usuários.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">6. Dados Financeiros</h2>
            <p>Os dados inseridos na Plataforma — extratos, valores, categorias — são de propriedade exclusiva do Usuário. O Radar Financeiro não acessa, vende, compartilha ou utiliza esses dados para qualquer finalidade além da prestação do serviço contratado.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">7. Conselheira IA</h2>
            <p>As análises e sugestões geradas pela inteligência artificial têm caráter informativo e educativo. Não constituem assessoria financeira, jurídica ou contábil profissional. O Usuário é o único responsável por suas decisões financeiras.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">8. Disponibilidade do Serviço</h2>
            <p>A Plataforma é fornecida "como está". Não garantimos disponibilidade ininterrupta, mas nos comprometemos a manter uptime adequado e a comunicar manutenções programadas com antecedência.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">9. Rescisão</h2>
            <p>O Usuário pode encerrar sua conta a qualquer momento. A Plataforma pode suspender ou encerrar contas que violem estes Termos, sem reembolso de períodos em uso.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">10. Legislação Aplicável</h2>
            <p>Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da Comarca de domicílio do Usuário para dirimir quaisquer controvérsias.</p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 text-base mb-2">11. Contato</h2>
            <p>Dúvidas sobre estes Termos: <strong>contato@radarfinanceiro.com.br</strong></p>
          </section>

        </div>

        <div className="mt-8 pt-6 border-t flex gap-4 text-sm">
          <a href="/privacidade" className="text-blue-600 hover:underline">Política de Privacidade</a>
          <a href="/login" className="text-gray-500 hover:underline">← Voltar ao login</a>
        </div>
      </div>
    </div>
  )
}
