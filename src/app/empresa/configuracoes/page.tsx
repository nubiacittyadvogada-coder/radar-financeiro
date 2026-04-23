'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function EmpresaConfiguracoesPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [config, setConfig] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')
  const [testando, setTestando] = useState(false)
  const [testeMsg, setTesteMsg] = useState('')
  const [testandoLembrete, setTestandoLembrete] = useState(false)
  const [configurandoWebhook, setConfigurandoWebhook] = useState(false)
  const [diagnosticando, setDiagnosticando] = useState(false)
  const [diagnosticoResult, setDiagnosticoResult] = useState<any>(null)
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [formFunc, setFormFunc] = useState({ nome: '', email: '', senha: '' })
  const [salvandoFunc, setSalvandoFunc] = useState(false)
  const [erroFunc, setErroFunc] = useState('')
  const [usuario, setUsuario] = useState<any>(null)
  const [mesmaInstancia, setMesmaInstancia] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setUsuario(parsed)
    setToken(t)
    carregarConfig(t)
    if (parsed.papel !== 'funcionario') carregarFuncionarios(t)
  }, [router])

  async function carregarConfig(t: string) {
    setLoading(true)
    const res = await fetch('/api/v2/empresa/configuracoes', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) {
      const data = await res.json()
      setConfig(data)
      // Detecta se usa mesma instância (cobrança vazia ou igual à jurídica)
      const usaMesma = !data.zapiInstanceIdCobranca ||
        data.zapiInstanceIdCobranca === data.zapiInstanceId
      setMesmaInstancia(usaMesma)
      setForm({
        nomeEmpresa: data.nomeEmpresa || '',
        cnpj: data.cnpj || '',
        setor: data.setor || '',
        telefoneAlerta: data.telefoneAlerta || '',
        chavePix: data.chavePix || '',
        alertaAtivo: data.alertaAtivo || false,
        metaReceita: data.metaReceita || '',
        metaLucro: data.metaLucro || '',
        asaasAtivo: data.asaasAtivo || false,
        asaasApiKey: '',
        zapiInstanceId: data.zapiInstanceId || '',
        zapiToken: '',
        zapiClientToken: '',
        zapiInstanceIdCobranca: data.zapiInstanceIdCobranca || '',
        zapiTokenCobranca: '',
        zapiClientTokenCobranca: '',
        cobrancaDescontoMax: data.cobrancaDescontoMax || '',
        cobrancaParcelasMax: data.cobrancaParcelasMax || '',
      })
    }
    setLoading(false)
  }

  async function carregarFuncionarios(t: string) {
    const res = await fetch('/api/v2/empresa/funcionarios', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) setFuncionarios(await res.json())
  }

  async function adicionarFuncionario() {
    if (!token) return
    if (!formFunc.nome || !formFunc.email || !formFunc.senha) { setErroFunc('Preencha todos os campos'); return }
    setSalvandoFunc(true)
    setErroFunc('')
    try {
      const res = await fetch('/api/v2/empresa/funcionarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formFunc),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setFormFunc({ nome: '', email: '', senha: '' })
      carregarFuncionarios(token)
    } catch (err: any) {
      setErroFunc(err.message)
    } finally {
      setSalvandoFunc(false)
    }
  }

  async function removerFuncionario(id: string, nome: string) {
    if (!token || !confirm(`Remover ${nome}?`)) return
    await fetch('/api/v2/empresa/funcionarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    carregarFuncionarios(token)
  }

  async function testarWhatsApp() {
    if (!token) return
    setTestando(true)
    setTesteMsg('')
    try {
      const res = await fetch('/api/v2/empresa/zapi/testar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        const detalhe = data.zapiResposta ? ` | Z-API: ${JSON.stringify(data.zapiResposta)}` : ''
        const statusInst = data.statusInstancia ? ` | Status: ${JSON.stringify(data.statusInstancia)}` : ''
        throw new Error((data.erro || 'Erro') + detalhe + statusInst)
      }
      const detalhe = data.zapiResposta ? ` | Z-API: ${JSON.stringify(data.zapiResposta)}` : ''
      setTesteMsg('✅ ' + data.mensagem + detalhe)
    } catch (err: any) {
      setTesteMsg('❌ ' + err.message)
    } finally {
      setTestando(false)
    }
  }

  async function testarLembrete() {
    if (!token) return
    setTestandoLembrete(true)
    setTesteMsg('')
    try {
      const res = await fetch('/api/v2/empresa/zapi/testar-lembrete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setTesteMsg(`✅ ${data.mensagem} (via ${data.instancia})`)
    } catch (err: any) {
      setTesteMsg('❌ ' + err.message)
    } finally {
      setTestandoLembrete(false)
    }
  }

  async function executarDiagnostico() {
    if (!token) return
    setDiagnosticando(true)
    setDiagnosticoResult(null)
    setTesteMsg('')
    try {
      const res = await fetch('/api/v2/empresa/zapi/diagnostico', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setDiagnosticoResult(data)
    } catch (err: any) {
      setTesteMsg('❌ Erro: ' + err.message)
    } finally {
      setDiagnosticando(false)
    }
  }

  async function configurarWebhook() {
    if (!token) return
    setConfigurandoWebhook(true)
    setTesteMsg('')
    try {
      const res = await fetch('/api/v2/empresa/configurar-webhook-zapi', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.ok) {
        setTesteMsg('✅ Webhook ativado! A IA agora vai responder mensagens dos devedores automaticamente.')
      } else {
        setTesteMsg(`⚠️ Não foi possível configurar automaticamente. ${data.instrucoes || 'Configure manualmente no painel Z-API.'}`)
      }
    } catch (err: any) {
      setTesteMsg('❌ ' + err.message)
    } finally {
      setConfigurandoWebhook(false)
    }
  }

  async function salvar() {
    if (!token) return
    setSalvando(true)
    setErro('')
    setSucesso(false)

    const payload: any = { ...form }
    // Remove + e espaços do telefone (Z-API não aceita +)
    if (payload.telefoneAlerta) payload.telefoneAlerta = payload.telefoneAlerta.replace(/\D/g, '')
    if (!payload.asaasApiKey) delete payload.asaasApiKey
    if (!payload.zapiToken) delete payload.zapiToken
    if (!payload.zapiClientToken) delete payload.zapiClientToken
    // Se marcou "mesma instância", limpa os campos de cobrança → API salva null → fallback automático
    if (mesmaInstancia) {
      payload.zapiInstanceIdCobranca = ''
      payload.zapiTokenCobranca = ''
      payload.zapiClientTokenCobranca = ''
    } else {
      if (!payload.zapiTokenCobranca) delete payload.zapiTokenCobranca
      if (!payload.zapiClientTokenCobranca) delete payload.zapiClientTokenCobranca
    }
    if (payload.metaReceita) payload.metaReceita = Number(payload.metaReceita)
    if (payload.metaLucro) payload.metaLucro = Number(payload.metaLucro)
    if (payload.cobrancaDescontoMax) payload.cobrancaDescontoMax = Number(payload.cobrancaDescontoMax)
    if (payload.cobrancaParcelasMax) payload.cobrancaParcelasMax = Number(payload.cobrancaParcelasMax)

    try {
      const res = await fetch('/api/v2/empresa/configuracoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setSucesso(true)
      setTimeout(() => setSucesso(false), 3000)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const inp = (label: string, key: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[key] ?? ''}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
      />
    </div>
  )

  if (loading) return <div className="p-10 text-gray-400">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Configurações da Empresa</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Dados básicos */}
        <div className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          <h2 className="font-semibold text-gray-800">Dados da empresa</h2>
          {inp('Nome da empresa', 'nomeEmpresa')}
          <div className="grid grid-cols-2 gap-4">
            {inp('CNPJ', 'cnpj', 'text', 'XX.XXX.XXX/0001-XX')}
            {inp('Setor', 'setor', 'text', 'Ex: Advocacia')}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {inp('Meta de Receita (R$)', 'metaReceita', 'number')}
            {inp('Meta de Lucro (R$)', 'metaLucro', 'number')}
          </div>
        </div>

        {/* Alertas WhatsApp */}
        <div className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          <h2 className="font-semibold text-gray-800">Alertas WhatsApp</h2>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="alertaAtivo"
              checked={form.alertaAtivo}
              onChange={(e) => setForm({ ...form, alertaAtivo: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="alertaAtivo" className="text-sm text-gray-700">
              Receber alertas de vencimento e resumo semanal
            </label>
          </div>
          {inp('Número WhatsApp', 'telefoneAlerta', 'text', '5531999096712')}
          <p className="text-xs text-gray-500">Formato: 55 + DDD + número (sem espaços, traços ou +)</p>
          {form.telefoneAlerta?.startsWith('+') && (
            <p className="text-xs text-orange-600 font-medium">⚠️ Remova o + do início — será corrigido automaticamente ao salvar</p>
          )}
          {inp('Chave PIX', 'chavePix', 'text', 'Ex: financeiro@ncadvogados.com.br ou CPF/CNPJ')}
          <p className="text-xs text-gray-500">Incluída automaticamente nos lembretes de honorários enviados aos clientes</p>
        </div>

        {/* Asaas */}
        <div className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          <h2 className="font-semibold text-gray-800">Asaas (Cobrança)</h2>
          <p className="text-sm text-gray-500">
            Integração com Asaas para gerar links de pagamento PIX e gerenciar cobranças de inadimplentes.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="asaasAtivo"
              checked={form.asaasAtivo}
              onChange={(e) => setForm({ ...form, asaasAtivo: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="asaasAtivo" className="text-sm text-gray-700">Ativar integração Asaas</label>
          </div>
          {form.asaasAtivo && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key Asaas
                  {config?.asaasApiKey && <span className="ml-2 text-xs text-gray-400">(atual: {config.asaasApiKey})</span>}
                </label>
                <input
                  type="password"
                  value={form.asaasApiKey}
                  onChange={(e) => setForm({ ...form, asaasApiKey: e.target.value })}
                  placeholder="Cole a nova key para atualizar"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {inp('Desconto máx. (%)', 'cobrancaDescontoMax', 'number', '30')}
                {inp('Parcelas máximas', 'cobrancaParcelasMax', 'number', '12')}
              </div>
            </>
          )}
        </div>

        {/* Z-API — seção simplificada */}
        <div className="bg-white rounded-xl p-6 shadow-sm border space-y-5">
          <div>
            <h2 className="font-semibold text-gray-800 text-lg">📱 WhatsApp (Z-API)</h2>
            <p className="text-sm text-gray-500 mt-1">
              Dados disponíveis em{' '}
              <a href="https://app.z-api.io" target="_blank" className="text-blue-600 underline font-medium">app.z-api.io</a>
              {' '}→ sua instância → aba Token.
            </p>
          </div>

          {/* Instância principal */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700">
              Instância Z-API
              {config?.zapiInstanceId && (
                <span className="ml-2 text-xs font-normal text-gray-400">atual: {config.zapiInstanceId}</span>
              )}
            </div>
            {inp('Instance ID', 'zapiInstanceId', 'text', 'Cole o Instance ID aqui')}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Token</label>
              <input type="password" value={form.zapiToken}
                onChange={(e) => setForm({ ...form, zapiToken: e.target.value })}
                placeholder={config?.zapiToken ? '●●●●●● (salvo — cole para atualizar)' : 'Cole o Token aqui'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Security Token</label>
              <input type="password" value={form.zapiClientToken}
                onChange={(e) => setForm({ ...form, zapiClientToken: e.target.value })}
                placeholder={config?.zapiClientToken ? '●●●●●● (salvo — cole para atualizar)' : 'Cole o Security Token aqui'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Toggle: um número ou dois? */}
          <div className="border-t pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={mesmaInstancia}
                onChange={(e) => setMesmaInstancia(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <div>
                <div className="text-sm font-medium text-gray-800">Tenho apenas um número WhatsApp</div>
                <div className="text-xs text-gray-500">Cobranças e alertas saem pelo mesmo número acima</div>
              </div>
            </label>
          </div>

          {/* Instância separada para cobrança (só aparece se dois números) */}
          {!mesmaInstancia && (
            <div className="border-2 border-orange-200 rounded-xl p-4 space-y-3">
              <div className="text-sm font-semibold text-gray-700">
                Instância separada para cobranças
                {config?.zapiInstanceIdCobranca && (
                  <span className="ml-2 text-xs font-normal text-gray-400">atual: {config.zapiInstanceIdCobranca}</span>
                )}
              </div>
              <div className="text-xs text-orange-700 bg-orange-50 px-3 py-2 rounded">
                Preencha apenas se tiver um <strong>segundo número</strong> dedicado para enviar cobranças aos clientes.
              </div>
              {inp('Instance ID (cobrança)', 'zapiInstanceIdCobranca', 'text', 'Instance ID do segundo número')}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Token (cobrança)</label>
                <input type="password" value={form.zapiTokenCobranca}
                  onChange={(e) => setForm({ ...form, zapiTokenCobranca: e.target.value })}
                  placeholder={config?.zapiTokenCobranca ? '●●●●●● (salvo — cole para atualizar)' : 'Cole o Token aqui'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Security Token (cobrança)</label>
                <input type="password" value={form.zapiClientTokenCobranca}
                  onChange={(e) => setForm({ ...form, zapiClientTokenCobranca: e.target.value })}
                  placeholder={config?.zapiClientTokenCobranca ? '●●●●●● (salvo — cole para atualizar)' : 'Cole o Security Token aqui'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Funcionários — só o dono vê */}
        {usuario?.papel !== 'funcionario' && (
          <div className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
            <h2 className="font-semibold text-gray-800">👥 Funcionários</h2>
            <p className="text-sm text-gray-500">
              Funcionários acessam apenas o módulo Empresa. Não têm acesso ao painel Pessoal.
            </p>
            {funcionarios.length > 0 && (
              <div className="space-y-2">
                {funcionarios.map((f) => (
                  <div key={f.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{f.nome}</div>
                      <div className="text-xs text-gray-400">{f.email}</div>
                    </div>
                    <button
                      onClick={() => removerFuncionario(f.id, f.nome)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Adicionar funcionário</p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nome"
                  value={formFunc.nome}
                  onChange={(e) => setFormFunc({ ...formFunc, nome: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={formFunc.email}
                  onChange={(e) => setFormFunc({ ...formFunc, email: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <input
                type="password"
                placeholder="Senha (mínimo 6 caracteres)"
                value={formFunc.senha}
                onChange={(e) => setFormFunc({ ...formFunc, senha: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {erroFunc && <p className="text-red-600 text-xs">{erroFunc}</p>}
              <button
                onClick={adicionarFuncionario}
                disabled={salvandoFunc}
                className="w-full py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900 disabled:opacity-50"
              >
                {salvandoFunc ? 'Criando...' : '+ Adicionar funcionário'}
              </button>
            </div>
          </div>
        )}

        {testeMsg && (
          <div className={`px-4 py-3 rounded-xl text-sm ${testeMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {testeMsg}
          </div>
        )}
        {erro && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">{erro}</div>}
        {sucesso && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm">Configurações salvas!</div>}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={testarWhatsApp}
            disabled={testando}
            className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            {testando ? 'Enviando...' : '📱 Testar Z-API'}
          </button>
          <button
            onClick={testarLembrete}
            disabled={testandoLembrete}
            className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50 text-sm"
          >
            {testandoLembrete ? 'Enviando...' : '🔔 Testar Lembrete'}
          </button>
          <button
            onClick={configurarWebhook}
            disabled={configurandoWebhook}
            className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 text-sm"
          >
            {configurandoWebhook ? 'Configurando...' : '🤖 Ativar IA Cobrança'}
          </button>
          <button
            onClick={executarDiagnostico}
            disabled={diagnosticando}
            className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 text-sm"
          >
            {diagnosticando ? 'Analisando...' : '🔍 Diagnóstico Z-API'}
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {salvando ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>

        {/* Painel de diagnóstico */}
        {diagnosticoResult && (
          <div className="bg-gray-900 text-gray-100 rounded-xl p-5 text-xs font-mono space-y-4">
            <div className="text-yellow-400 font-bold text-sm">🔍 Resultado do Diagnóstico</div>

            {/* Instância Jurídico */}
            <div className="border border-gray-700 rounded-lg p-3 space-y-2">
              <div className="text-blue-300 font-bold">⚖️ Instância JURÍDICO (alertas internos para você)</div>
              <div>
                <span className="text-gray-400">ID: </span>
                <span className="text-white">{diagnosticoResult.juridico?.instanceId || '❌ Não configurado'}</span>
              </div>
              {diagnosticoResult.juridico?.configurado && (
                <>
                  <div>
                    <span className="text-gray-400">Status: </span>
                    <span className={diagnosticoResult.juridico?.status?.body?.connected ? 'text-green-400' : 'text-red-400'}>
                      {diagnosticoResult.juridico?.status?.body?.connected ? '✅ Conectado' : '❌ Desconectado — escaneie o QR no painel Z-API'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Teste de envio: </span>
                    <span className={diagnosticoResult.juridico?.testeEnvio?.ok ? 'text-green-400' : 'text-red-400'}>
                      {diagnosticoResult.juridico?.testeEnvio?.ok ? '✅ Enviou!' : `❌ Falhou (HTTP ${diagnosticoResult.juridico?.testeEnvio?.status})`}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Instância Cobrança */}
            <div className="border border-orange-700 rounded-lg p-3 space-y-2">
              <div className="text-orange-300 font-bold">💬 Instância COBRANÇA (mensagens para clientes/devedores)</div>
              <div>
                <span className="text-gray-400">ID: </span>
                <span className="text-white">{diagnosticoResult.cobranca?.instanceId || '❌ Não configurado'}</span>
                {diagnosticoResult.cobranca?.usandoFallbackJuridico && (
                  <span className="text-yellow-400 ml-2">(usando fallback: instância jurídica)</span>
                )}
              </div>
              {diagnosticoResult.cobranca?.configurado && (
                <>
                  <div>
                    <span className="text-gray-400">Status: </span>
                    <span className={diagnosticoResult.cobranca?.status?.body?.connected ? 'text-green-400' : 'text-red-400'}>
                      {diagnosticoResult.cobranca?.status?.body?.connected ? '✅ Conectado' : '❌ Desconectado — escaneie o QR no painel Z-API'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Teste de envio: </span>
                    <span className={diagnosticoResult.cobranca?.testeEnvio?.ok ? 'text-green-400' : 'text-red-400'}>
                      {diagnosticoResult.cobranca?.testeEnvio?.ok ? '✅ Enviou!' : `❌ Falhou (HTTP ${diagnosticoResult.cobranca?.testeEnvio?.status})`}
                    </span>
                    {!diagnosticoResult.cobranca?.testeEnvio?.ok && diagnosticoResult.cobranca?.testeEnvio?.body && (
                      <div className="text-red-300 mt-1 break-all">
                        {JSON.stringify(diagnosticoResult.cobranca?.testeEnvio?.body).substring(0, 200)}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Webhook */}
            {diagnosticoResult.juridico?.webhookAtual && (
              <div className="space-y-1">
                <div className="text-gray-400">Webhook recebimento configurado:</div>
                <div className="text-white break-all text-xs">
                  {diagnosticoResult.juridico?.webhookAtual?.body?.value ||
                   diagnosticoResult.juridico?.webhookAtual?.body?.webhookUrl ||
                   diagnosticoResult.juridico?.webhookAtual?.body?.receivedUrl ||
                   JSON.stringify(diagnosticoResult.juridico?.webhookAtual?.body).substring(0, 150)}
                </div>
              </div>
            )}

            {/* Últimas mensagens recebidas */}
            {diagnosticoResult.ultimosWebhooksRecebidos?.length > 0 ? (
              <div>
                <div className="text-gray-400 mb-1">Últimas mensagens recebidas dos clientes:</div>
                {diagnosticoResult.ultimosWebhooksRecebidos.map((l: any, i: number) => (
                  <div key={i} className="bg-gray-800 rounded px-2 py-1 mb-1">
                    <span className="text-gray-500">{new Date(l.criadoEm).toLocaleString('pt-BR')} — </span>
                    <span className="text-green-300">{l.titulo}: </span>
                    <span className="text-gray-300">{l.mensagem.substring(0, 80)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-yellow-400">⚠️ Nenhuma mensagem chegou ao webhook ainda</div>
            )}

            {/* Últimas cobranças enviadas */}
            {diagnosticoResult.ultimasCobrancasEnviadas?.length > 0 && (
              <div>
                <div className="text-gray-400 mb-1">Últimas cobranças enviadas:</div>
                {diagnosticoResult.ultimasCobrancasEnviadas.map((m: any, i: number) => (
                  <div key={i} className="bg-gray-800 rounded px-2 py-1 mb-1">
                    <span className={m.enviado ? 'text-green-400' : 'text-red-400'}>{m.enviado ? '✅' : '❌'} </span>
                    <span className="text-gray-300">{m.devedor} — </span>
                    <span className="text-gray-500">{new Date(m.criadoEm).toLocaleString('pt-BR')}</span>
                    <div className="text-gray-400 mt-0.5 italic">{m.trecho}...</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
