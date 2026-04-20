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
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [formFunc, setFormFunc] = useState({ nome: '', email: '', senha: '' })
  const [salvandoFunc, setSalvandoFunc] = useState(false)
  const [erroFunc, setErroFunc] = useState('')
  const [usuario, setUsuario] = useState<any>(null)

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
        asaasApiKey: '',  // sempre limpo por segurança
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
      if (!res.ok) throw new Error(data.erro)
      setTesteMsg('✅ ' + data.mensagem)
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

    // Só envia campos não vazios de credenciais
    const payload: any = { ...form }
    if (!payload.asaasApiKey) delete payload.asaasApiKey
    if (!payload.zapiToken) delete payload.zapiToken
    if (!payload.zapiClientToken) delete payload.zapiClientToken
    if (!payload.zapiTokenCobranca) delete payload.zapiTokenCobranca
    if (!payload.zapiClientTokenCobranca) delete payload.zapiClientTokenCobranca
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
          <p className="text-xs text-gray-500">Formato: 55 + DDD + número (sem espaços ou traços)</p>
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

        {/* Z-API */}
        <div className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          <h2 className="font-semibold text-gray-800">Z-API (WhatsApp)</h2>
          <p className="text-sm text-gray-500">
            Integração Z-API para enviar mensagens de cobrança personalizadas via WhatsApp.
          </p>
          {inp('Instance ID', 'zapiInstanceId', 'text', 'Ex: 3F13F86C80D15015D87D4AC8C214C6FF')}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Token
              {config?.zapiToken && <span className="ml-2 text-xs text-gray-400">(atual: {config.zapiToken})</span>}
            </label>
            <input
              type="password"
              value={form.zapiToken}
              onChange={(e) => setForm({ ...form, zapiToken: e.target.value })}
              placeholder="Cole o novo token para atualizar"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Token
              {config?.zapiClientToken && <span className="ml-2 text-xs text-gray-400">(atual: {config.zapiClientToken})</span>}
            </label>
            <input
              type="password"
              value={form.zapiClientToken}
              onChange={(e) => setForm({ ...form, zapiClientToken: e.target.value })}
              placeholder="Cole o novo client token para atualizar"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
            />
          </div>
          <div className="pt-2 border-t">
            <p className="text-xs text-gray-500 bg-blue-50 rounded px-3 py-2">
              💡 A instância acima é a <strong>Jurídica</strong> — usada para alertas internos, DRE e resumos enviados a você.
            </p>
          </div>
        </div>

        {/* Z-API Cobrança */}
        <div className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          <h2 className="font-semibold text-gray-800">Z-API Cobrança (WhatsApp)</h2>
          <p className="text-sm text-gray-500">
            Número dedicado para mensagens aos clientes/devedores (lembretes de honorários, cobranças).
            Se não configurado, usa o número jurídico como fallback.
          </p>
          {inp('Instance ID', 'zapiInstanceIdCobranca', 'text', 'Ex: A1B2C3D4E5F6...')}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Token
              {config?.zapiTokenCobranca && <span className="ml-2 text-xs text-gray-400">(configurado ✓)</span>}
            </label>
            <input
              type="password"
              value={form.zapiTokenCobranca}
              onChange={(e) => setForm({ ...form, zapiTokenCobranca: e.target.value })}
              placeholder="Cole o novo token para atualizar"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Token
              {config?.zapiClientTokenCobranca && <span className="ml-2 text-xs text-gray-400">(configurado ✓)</span>}
            </label>
            <input
              type="password"
              value={form.zapiClientTokenCobranca}
              onChange={(e) => setForm({ ...form, zapiClientTokenCobranca: e.target.value })}
              placeholder="Cole o novo client token para atualizar"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
            />
          </div>
          <div className="pt-2 border-t">
            <p className="text-xs text-gray-500 bg-orange-50 rounded px-3 py-2">
              💡 Esta é a instância de <strong>Cobrança</strong> — usada para lembretes de honorários e mensagens automáticas para clientes.
            </p>
          </div>
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
            onClick={salvar}
            disabled={salvando}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {salvando ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </main>
    </div>
  )
}
