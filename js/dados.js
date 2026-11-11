/* ==========================================================================
   Dados locais (localStorage) + comunicação com o Google Apps Script
   - Tudo é gravado primeiro no aparelho e entra numa FILA de envio.
   - A fila é enviada quando há internet (a cada CONFIG.SYNC_SEGUNDOS e ao reconectar).
   - Cada registro tem um ID único: reenviar não duplica nada na planilha.
   ========================================================================== */
(function () {
  const P = 'cp_';
  const DEMO = !CONFIG.API_URL;
  const DIAS_MANTER = 120; // presenças antigas ficam só na planilha (o relatório busca lá)

  function ler(k, padrao) {
    try { const v = localStorage.getItem(P + k); return v == null ? padrao : JSON.parse(v); }
    catch (e) { return padrao; }
  }
  function gravar(k, v) {
    try { localStorage.setItem(P + k, JSON.stringify(v)); }
    catch (e) { U.toast('Memória do aparelho cheia! Sincronize assim que possível.', 'erro'); }
  }

  const S = {
    sessao: ler('sessao', null),
    alunos: ler('alunos', {}),
    freq: ler('freq', {}),
    versaoBase: ler('versaoBase', ''),
    presencas: ler('presencas', {}),
    avisos: ler('avisos', {}),
    fila: ler('fila', []),
    ultimaSync: ler('ultimaSync', ''),
    dispositivo: ler('dispositivo', '')
  };
  if (!S.dispositivo) { S.dispositivo = 'cel-' + U.uuid().slice(0, 6); gravar('dispositivo', S.dispositivo); }

  const ouvintes = [];
  const D = {
    S, DEMO,
    online: navigator.onLine,
    sincronizando: false,
    aoMudar(fn) { ouvintes.push(fn); },
    avisar(motivo) { ouvintes.forEach((fn) => { try { fn(motivo); } catch (e) { console.error(e); } }); },
    salvar(...chaves) { chaves.forEach((k) => gravar(k, S[k])); }
  };

  // ------------------------------------------------------------------ API
  D.api = async function (acao, dados) {
    if (DEMO) throw new Error('Modo demonstração');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45000);
    try {
      const resp = await fetch(CONFIG.API_URL, {
        method: 'POST',
        // text/plain evita a requisição "preflight" de CORS que o Apps Script não responde
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ acao, token: S.sessao && S.sessao.token, dispositivo: S.dispositivo }, dados || {})),
        signal: ctrl.signal,
        redirect: 'follow'
      });
      const r = await resp.json();
      D.online = true;
      if (!r.ok && r.erro === 'SESSAO_EXPIRADA') {
        D.sair(true);
        throw new Error('Sessão expirada. Entre novamente.');
      }
      if (!r.ok) throw new Error(r.erro || 'Erro no servidor');
      return r;
    } catch (e) {
      if (e.name === 'AbortError' || e instanceof TypeError) D.online = false;
      throw e;
    } finally {
      clearTimeout(t);
    }
  };

  // ------------------------------------------------------------------ Sessão
  D.logado = () => !!(S.sessao && S.sessao.exp > Date.now());
  D.admin = () => !!(S.sessao && S.sessao.perfil === 'admin');

  D.entrar = async function (usuario, senha) {
    if (DEMO) {
      if (usuario.trim().toLowerCase() === 'admin' && senha === 'admin') {
        S.sessao = { token: 'demo', usuario: 'admin', nome: 'Demonstração', perfil: 'admin', exp: Date.now() + 30 * 86400000 };
        D.salvar('sessao');
        return S.sessao;
      }
      throw new Error('Usuário ou senha incorretos (demo: admin / admin)');
    }
    const r = await D.api('login', { usuario, senha });
    S.sessao = { token: r.token, usuario: r.usuario, nome: r.nome, perfil: r.perfil, exp: r.exp };
    D.salvar('sessao');
    await D.carregarBase(true).catch(() => {});
    return S.sessao;
  };

  D.sair = function (silencioso) {
    if (!silencioso && !DEMO && S.sessao) D.api('logout').catch(() => {});
    S.sessao = null; D.salvar('sessao');
    D.avisar('sessao');
  };

  // ------------------------------------------------------------------ Usuários
  const SO_ONLINE = 'Disponível só com a planilha conectada (fora do modo demonstração) e com internet.';
  D.listarUsuarios = async function () {
    if (DEMO) throw new Error(SO_ONLINE);
    return (await D.api('listarUsuarios')).usuarios;
  };
  D.salvarUsuario = async function (dados) {
    if (DEMO) throw new Error(SO_ONLINE);
    return (await D.api('salvarUsuario', dados)).usuarios;
  };
  D.alterarSenha = async function (senhaAtual, novaSenha) {
    if (DEMO) throw new Error(SO_ONLINE);
    await D.api('alterarSenha', { senhaAtual, novaSenha });
  };

  // ------------------------------------------------------------------ Normalização vinda da planilha
  const deAluno = (a) => ({
    rm: String(a.RM), nome: a.Nome, serie: String(a.Serie), turma: a.Turma, habilitacao: a.Habilitacao,
    grupo: a.Grupo, ano: a.Ano, nomeResponsavel: a.NomeResponsavel, telefone: a.TelefoneResponsavel,
    ativo: a.Ativo !== 'NAO'
  });
  const deFreq = (f) => ({
    rm: String(f.RM), disciplinas: f.Disciplinas || {}, totalAulas: num(f.TotalAulas), totalFaltas: num(f.TotalFaltas),
    faltasAcumuladas: num(f.FaltasAcumuladas), freqAcumulada: num(f.FreqAcumulada), importadoEm: f.ImportadoEm
  });
  const dePresenca = (p) => ({
    id: p.ID, data: p.Data, hora: p.Hora, rm: String(p.RM), nome: p.Nome, serie: p.Serie, turma: p.Turma,
    status: p.Status, operador: p.Operador, dispositivo: p.Dispositivo, origem: p.Origem, registradoEm: p.RegistradoEm, enviado: true
  });
  const deAviso = (a) => ({
    id: a.ID, rm: String(a.RM), nome: a.Nome, turma: a.Turma, tipo: a.Tipo, dataReferencia: a.DataReferencia,
    telefone: a.Telefone, operador: a.Operador, enviadoEm: a.EnviadoEm, enviado: true
  });
  function num(v) { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return isNaN(n) ? null : n; }
  D.dePresenca = dePresenca;

  // ------------------------------------------------------------------ Base (alunos + frequência)
  D.carregarBase = async function (forcar) {
    if (DEMO) return;
    const r = await D.api('base', { versao: forcar ? '' : S.versaoBase });
    if (r.atualizado) return;
    const alunos = {};
    r.alunos.forEach((a) => { const x = deAluno(a); alunos[x.rm] = x; });
    // contatos editados aqui e ainda não enviados não podem ser perdidos
    S.fila.filter((o) => o.tipo === 'contato').forEach((o) => {
      if (alunos[o.dados.rm]) { alunos[o.dados.rm].telefone = o.dados.telefone; alunos[o.dados.rm].nomeResponsavel = o.dados.nomeResponsavel; }
    });
    const freq = {};
    r.frequencia.forEach((f) => { const x = deFreq(f); freq[x.rm] = x; });
    S.alunos = alunos; S.freq = freq; S.versaoBase = r.versao;
    D.salvar('alunos', 'freq', 'versaoBase');
    D.avisar('base');
  };

  // ------------------------------------------------------------------ Fila
  function enfileirar(tipo, dados) {
    if (DEMO) { dados.enviado = true; D.avisar('fila'); return; } // demo: não há planilha para enviar
    S.fila.push({ tipo, id: dados.id, dados });
    D.salvar('fila');
    D.avisar('fila');
    D.sincronizar();
  }
  D.pendentes = () => S.fila.length;

  // ------------------------------------------------------------------ Sincronização
  D.sincronizar = async function (datasExtras) {
    if (DEMO || !D.logado() || D.sincronizando) return;
    if (!navigator.onLine) { D.online = false; D.avisar('sync'); return; }
    D.sincronizando = true; D.avisar('sync');
    try {
      const lote = S.fila.slice(0, 150);
      const datas = [U.hojeStr()].concat(datasExtras || []);
      const r = await D.api('sync', { operacoes: lote, datas });

      const resolvidos = new Set(r.aceitos);
      (r.duplicados || []).forEach((d) => {
        resolvidos.add(d.id);
        delete S.presencas[d.id];          // outro aparelho registrou antes; vale o registro dele
      });
      S.fila = S.fila.filter((o) => !resolvidos.has(o.id));
      lote.forEach((o) => {
        if (!resolvidos.has(o.id)) return;
        if (o.tipo === 'presenca' && S.presencas[o.id]) S.presencas[o.id].enviado = true;
        if (o.tipo === 'aviso' && S.avisos[o.id]) S.avisos[o.id].enviado = true;
      });

      // Mescla o movimento do dia vindo de todos os aparelhos
      r.presencas.forEach((p) => {
        const x = dePresenca(p);
        const local = D.presencaDoDia(x.rm, x.data);
        if (local && local.id !== x.id && !local.enviado) delete S.presencas[local.id];
        S.presencas[x.id] = x;
      });
      r.avisos.forEach((a) => { const x = deAviso(a); S.avisos[x.id] = x; });

      limparAntigos();
      S.ultimaSync = U.agoraIso();
      D.salvar('fila', 'presencas', 'avisos', 'ultimaSync');
      if (r.versaoBase && r.versaoBase !== S.versaoBase) await D.carregarBase().catch(() => {});
      D.sincronizando = false;
      D.avisar('sync');
      if (S.fila.length && lote.length === 150) setTimeout(() => D.sincronizar(), 500);
    } catch (e) {
      console.warn('sync falhou', e);
      D.sincronizando = false;
      D.avisar('sync');
    }
  };

  function limparAntigos() {
    const corte = U.dataStr(new Date(Date.now() - DIAS_MANTER * 86400000));
    if (DEMO) return; // no modo demo o aparelho é o único lugar dos dados
    Object.values(S.presencas).forEach((p) => { if (p.data < corte && p.enviado) delete S.presencas[p.id]; });
    Object.values(S.avisos).forEach((a) => { if ((a.enviadoEm || '') < corte && a.enviado) delete S.avisos[a.id]; });
  }

  // ------------------------------------------------------------------ Presenças
  D.presencaDoDia = (rm, data) => Object.values(S.presencas).find((p) => p.rm === rm && p.data === data);
  D.presencasDoDia = (data) => Object.values(S.presencas).filter((p) => p.data === data).sort((a, b) => (a.hora < b.hora ? 1 : -1));

  /** Registra a entrada. Retorna {tipo:'ok'|'atraso'|'repetido'|'erro', aluno, presenca, msg} */
  D.registrarEntrada = function (texto, origem) {
    const rm = U.normalizarRM(texto);
    if (!rm && U.ehQrNSA(texto)) return { tipo: 'erro', nsa: true, msg: 'Carteirinha NSA: este QR não traz o RM. Digite o RM no campo abaixo.' };
    if (!rm) return { tipo: 'erro', msg: 'QR Code sem RM válido' };
    const aluno = S.alunos[rm];
    if (!aluno) return { tipo: 'erro', msg: `RM ${rm} não encontrado na base` };
    if (!aluno.ativo) return { tipo: 'erro', aluno, msg: 'Aluno inativo / transferido' };

    const agora = new Date();
    const data = U.dataStr(agora), hora = U.horaStr(agora);
    const existente = D.presencaDoDia(rm, data);
    if (existente) return { tipo: 'repetido', aluno, presenca: existente, msg: `Já registrado às ${existente.hora.slice(0, 5)}` };

    const p = {
      id: U.uuid(), data, hora, rm, nome: aluno.nome, serie: aluno.serie, turma: aluno.turma,
      status: U.statusPorHora(hora), operador: S.sessao.usuario, dispositivo: S.dispositivo,
      origem: origem || 'qr', registradoEm: U.agoraIso(), enviado: false
    };
    S.presencas[p.id] = p;
    D.salvar('presencas');
    enfileirar('presenca', p);
    return { tipo: p.status === 'Atrasado' ? 'atraso' : 'ok', aluno, presenca: p };
  };

  // ------------------------------------------------------------------ Avisos (WhatsApp)
  D.avisosDe = (rm, tipo) => Object.values(S.avisos).filter((a) => a.rm === rm && (!tipo || a.tipo === tipo)).sort((a, b) => (a.enviadoEm < b.enviadoEm ? 1 : -1));
  D.avisoEnviado = (rm, tipo, dataRef) => Object.values(S.avisos).find((a) => a.rm === rm && a.tipo === tipo && a.dataReferencia === dataRef);
  D.registrarAviso = function (aluno, tipo, dataRef, telefone) {
    const a = {
      id: U.uuid(), rm: aluno.rm, nome: aluno.nome, turma: U.rotuloTurma(aluno), tipo, dataReferencia: dataRef,
      telefone, operador: S.sessao.usuario, enviadoEm: U.agoraIso(), enviado: false
    };
    S.avisos[a.id] = a;
    D.salvar('avisos');
    enfileirar('aviso', a);
    return a;
  };

  // ------------------------------------------------------------------ Contatos
  D.salvarContato = function (rm, nomeResponsavel, telefone) {
    const a = S.alunos[rm]; if (!a) return;
    a.nomeResponsavel = nomeResponsavel; a.telefone = telefone;
    D.salvar('alunos');
    enfileirar('contato', { id: U.uuid(), rm, nomeResponsavel, telefone });
  };

  // ------------------------------------------------------------------ Importação
  /** Aplica localmente (mesma regra do servidor: upsert por RM, preserva contato) */
  function aplicarAlunosLocal(lista, inativarAusentes, turmas) {
    let novos = 0, atualizados = 0, transferidos = 0, inativados = 0;
    const recebidos = new Set();
    lista.forEach((a) => {
      recebidos.add(a.rm);
      const old = S.alunos[a.rm];
      if (old) {
        if (U.chaveTurma(old) !== U.chaveTurma(a)) transferidos++; else atualizados++;
        S.alunos[a.rm] = Object.assign({}, old, a, {
          nomeResponsavel: a.nomeResponsavel || old.nomeResponsavel || '',
          telefone: a.telefone || old.telefone || '', ativo: true
        });
      } else { S.alunos[a.rm] = Object.assign({ nomeResponsavel: '', telefone: '' }, a, { ativo: true }); novos++; }
    });
    if (inativarAusentes) {
      Object.values(S.alunos).forEach((a) => {
        if (turmas.includes(U.chaveTurma(a)) && !recebidos.has(a.rm) && a.ativo) { a.ativo = false; inativados++; }
      });
    }
    D.salvar('alunos');
    return { novos, atualizados, transferidos, inativados };
  }
  function aplicarFreqLocal(lista) {
    let novos = 0, atualizados = 0;
    lista.forEach((f) => {
      if (S.freq[f.rm]) atualizados++; else novos++;
      S.freq[f.rm] = Object.assign({}, f, { importadoEm: U.agoraIso() });
    });
    D.salvar('freq');
    return { novos, atualizados };
  }

  D.importarAlunos = async function (lista, inativarAusentes) {
    const turmas = [...new Set(lista.map(U.chaveTurma))];
    if (DEMO) { const r = aplicarAlunosLocal(lista, inativarAusentes, turmas); D.avisar('base'); return r; }
    const r = await D.api('importarAlunos', { alunos: lista, inativarAusentes, turmas });
    await D.carregarBase(true);
    return r;
  };
  D.importarFrequencia = async function (lista) {
    if (DEMO) { const r = aplicarFreqLocal(lista); D.avisar('base'); return r; }
    const r = await D.api('importarFrequencia', { registros: lista });
    await D.carregarBase(true);
    return r;
  };

  // ------------------------------------------------------------------ Relatórios
  /** Histórico completo (ano) de portaria do aluno: busca na planilha; offline usa o que há no aparelho */
  D.historicoAluno = async function (rm) {
    if (!DEMO && navigator.onLine) {
      try {
        const r = await D.api('historicoAluno', { rm });
        return { presencas: r.presencas.map(dePresenca), diasLetivos: r.diasLetivos, avisos: r.avisos.map(deAviso), fonte: 'planilha' };
      } catch (e) { console.warn(e); }
    }
    const todas = Object.values(S.presencas);
    return {
      presencas: todas.filter((p) => p.rm === rm),
      diasLetivos: [...new Set(todas.map((p) => p.data))].sort(),
      avisos: D.avisosDe(rm),
      fonte: 'aparelho'
    };
  };

  D.presencasPeriodo = async function (inicio, fim) {
    if (!DEMO && navigator.onLine) {
      try {
        const r = await D.api('relatorioPeriodo', { inicio, fim });
        return { presencas: r.presencas.map(dePresenca), diasLetivos: r.diasLetivos, fonte: 'planilha' };
      } catch (e) { console.warn(e); }
    }
    const lista = Object.values(S.presencas).filter((p) => p.data >= inicio && p.data <= fim);
    return { presencas: lista, diasLetivos: [...new Set(lista.map((p) => p.data))].sort(), fonte: 'aparelho' };
  };

  // ------------------------------------------------------------------ Listas auxiliares
  D.turmas = function () {
    const m = new Map();
    Object.values(S.alunos).forEach((a) => { if (a.ativo) m.set(U.chaveTurma(a), U.rotuloTurma(a)); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  };
  D.alunosDaTurma = (chave) => Object.values(S.alunos)
    .filter((a) => a.ativo && (!chave || U.chaveTurma(a) === chave))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  // ------------------------------------------------------------------ Eventos de conexão
  window.addEventListener('online', () => { D.online = true; D.avisar('sync'); D.sincronizar(); });
  window.addEventListener('offline', () => { D.online = false; D.avisar('sync'); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) D.sincronizar(); });
  setInterval(() => D.sincronizar(), (CONFIG.SYNC_SEGUNDOS || 20) * 1000);

  window.D = D;
})();
