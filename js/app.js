/* Interface principal */
(function () {
  const { $, $$, esc } = U;
  const App = { abaAtual: 'portaria', seg: 'atrasados' };
  window.App = App;

  // ------------------------------------------------------------------ Inicialização
  function iniciar() {
    $('#limite-txt').textContent = CONFIG.HORARIO_LIMITE;
    $('#login-demo').hidden = !D.DEMO;
    $('#faixa-demo').hidden = !D.DEMO;
    $('#hoje-data').value = U.hojeStr();
    $('#hoje-data').max = U.hojeStr();

    $('#form-login').addEventListener('submit', entrar);
    $$('.abas button').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.aba)));
    $('#btn-camera').addEventListener('click', () => { U.liberarAudio(); Leitor.querLigado = true; Leitor.ligar(lerCodigo); });
    $('#form-manual').addEventListener('submit', (e) => {
      e.preventDefault(); U.liberarAudio();
      const v = $('#rm-manual').value; if (!v.trim()) return;
      lerCodigo(v, 'manual'); $('#rm-manual').value = '';
    });
    $('#status-sync').addEventListener('click', () => { D.sincronizar(); D.carregarBase().catch(() => {}); U.toast(D.DEMO ? 'Modo demonstração: nada a sincronizar' : 'Sincronizando…'); });
    $('#btn-menu').addEventListener('click', abrirMenu);
    $('#resultado').addEventListener('click', () => { $('#resultado').hidden = true; });
    $('#painel').addEventListener('click', (e) => { if (e.target.closest('[data-fechar]')) fecharPainel(); });

    $('#hoje-data').addEventListener('change', () => { D.sincronizar([$('#hoje-data').value]); renderHoje(); });
    $('#hoje-turma').addEventListener('change', renderHoje);
    $$('.segmentos button').forEach((b) => b.addEventListener('click', () => {
      $$('.segmentos button').forEach((x) => x.classList.toggle('ativo', x === b));
      App.seg = b.dataset.seg; renderHoje();
    }));
    $('#busca-aluno').addEventListener('input', renderAlunos);
    $('#alunos-turma').addEventListener('change', renderAlunos);
    $('#btn-pdf-turma').addEventListener('click', () => {
      const t = $('#alunos-turma').value;
      if (!t) { U.toast('Escolha uma turma no filtro.', 'erro'); return; }
      PDF.turma(t);
    });
    $('#btn-lote-freq').addEventListener('click', loteFrequencia);
    $('#btn-xls-turma').addEventListener('click', () => Excel.turma($('#alunos-turma').value));
    $('#btn-pdf-dia').addEventListener('click', () => PDF.dia($('#hoje-data').value || U.hojeStr(), $('#hoje-turma').value));
    $('#btn-xls-dia').addEventListener('click', () => Excel.dia($('#hoje-data').value || U.hojeStr(), $('#hoje-turma').value));
    $('#btn-modelo-contatos').addEventListener('click', () => Excel.modeloContatos());
    $('#arquivo').addEventListener('change', async (e) => {
      const arq = e.target.files[0]; if (!arq) return;
      try { Importador.mostrarPreview(await Importador.ler(arq)); }
      catch (err) { U.toast(err.message, 'erro'); $('#preview').hidden = true; }
    });

    D.aoMudar((motivo) => {
      if (motivo === 'sessao') { mostrarTela(); return; }
      atualizarStatus();
      if (motivo === 'base') { preencherTurmas(); }
      if (motivo === 'sync' || motivo === 'base' || motivo === 'fila') { renderPortaria(); if (App.abaAtual === 'hoje') renderHoje(); if (App.abaAtual === 'alunos') renderAlunos(); }
    });

    setInterval(relogio, 1000); relogio();
    mostrarTela();
    registrarSW();
  }

  function mostrarTela() {
    const ok = D.logado();
    $('#tela-login').hidden = ok;
    $('#app').hidden = !ok;
    if (!ok) { Leitor.desligar(); return; }
    $('#topo-usuario').textContent = D.S.sessao.nome;
    $$('[data-admin]').forEach((el) => { el.hidden = !D.admin(); });
    App.atualizarTudo();
    D.carregarBase().catch(() => {});
    D.sincronizar();
    irPara(App.abaAtual);
  }

  async function entrar(e) {
    e.preventDefault();
    U.liberarAudio();
    const btn = $('#btn-entrar'); btn.disabled = true; btn.textContent = 'Entrando…';
    $('#login-erro').textContent = '';
    try {
      await D.entrar($('#login-usuario').value, $('#login-senha').value);
      $('#login-senha').value = '';
      mostrarTela();
    } catch (err) {
      $('#login-erro').textContent = !navigator.onLine ? 'Sem internet. O primeiro acesso precisa de conexão.' : err.message;
    } finally { btn.disabled = false; btn.textContent = 'Entrar'; }
  }

  App.atualizarTudo = function () { preencherTurmas(); atualizarStatus(); renderPortaria(); renderHoje(); renderAlunos(); };

  function irPara(aba) {
    App.abaAtual = aba;
    $$('.aba').forEach((s) => { s.hidden = s.id !== 'aba-' + aba; });
    $$('.abas button').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === aba));
    if (aba === 'portaria') { if (Leitor.querLigado) Leitor.ligar(lerCodigo); }
    else Leitor.desligar();
    if (aba === 'hoje') renderHoje();
    if (aba === 'alunos') renderAlunos();
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ Relógio / status
  function relogio() {
    const d = new Date();
    $('#relogio-hora').textContent = U.horaStr(d).slice(0, 5);
    $('#relogio-data').textContent = `${U.diaSemana(U.dataStr(d))}, ${U.fmtData(U.dataStr(d))}`;
    const aberto = U.horaStr(d).slice(0, 5) <= CONFIG.HORARIO_LIMITE;
    const p = $('#relogio-portao');
    p.className = 'portao ' + (aberto ? 'aberto' : 'fechado');
    p.innerHTML = aberto ? `Portão aberto até <b>${CONFIG.HORARIO_LIMITE}</b>` : `Portão fechado · entradas = <b>atraso</b>`;
  }

  function atualizarStatus() {
    const b = $('#status-sync');
    const n = D.pendentes();
    let cls, txt;
    if (D.DEMO) { cls = 'demo'; txt = 'Demo'; }
    else if (!navigator.onLine || !D.online) { cls = 'off'; txt = n ? `Offline · ${n}` : 'Offline'; }
    else if (D.sincronizando) { cls = 'sync'; txt = 'Enviando…'; }
    else if (n) { cls = 'pend'; txt = `${n} a enviar`; }
    else { cls = 'on'; txt = 'Sincronizado'; }
    b.className = 'status-sync ' + cls;
    b.querySelector('.texto').textContent = txt;
    b.title = D.S.ultimaSync ? `Última sincronização: ${U.fmtDataHora(D.S.ultimaSync)}` : '';
    $('#faixa-offline').hidden = D.DEMO || (navigator.onLine && D.online);
    $('#cont-pend').textContent = n;
  }

  // ------------------------------------------------------------------ Leitura
  function lerCodigo(texto, origem) {
    const r = D.registrarEntrada(texto, origem || 'qr');
    U.feedback(r.tipo);
    const box = $('#resultado');
    box.className = 'resultado ' + r.tipo;
    const st = r.nsa ? '⌨ DIGITE O RM' : { ok: '✔ NO HORÁRIO', atraso: '⏰ ATRASADO', repetido: 'ℹ JÁ REGISTRADO', erro: '✖ NÃO REGISTRADO' }[r.tipo];
    $('#res-status').textContent = st;
    $('#res-nome').textContent = r.aluno ? U.nomeProprio(r.aluno.nome) : r.nsa ? 'Carteirinha digital NSA' : (r.msg || '');
    $('#res-info').innerHTML = r.aluno
      ? `RM ${esc(r.aluno.rm)} · ${esc(U.rotuloTurma(r.aluno))}<br>${r.presenca ? (r.tipo === 'repetido' ? esc(r.msg) : 'Entrada às ' + r.presenca.hora.slice(0, 5)) : esc(r.msg || '')}`
      : r.nsa ? 'Este QR não traz o RM.<br>Digite a <b>matrícula</b> que aparece na frente da carteirinha.'
        : 'Confira o RM ou digite manualmente';
    box.hidden = false;
    clearTimeout(App._tRes);
    App._tRes = setTimeout(() => {
      box.hidden = true;
      if (r.nsa) $('#rm-manual').focus();
    }, r.tipo === 'erro' ? 3200 : 2200);
    renderPortaria();
  }

  function renderPortaria() {
    if (!D.logado()) return;
    const hoje = D.presencasDoDia(U.hojeStr());
    $('#cont-total').textContent = hoje.length;
    $('#cont-ok').textContent = hoje.filter((p) => p.status === 'No horário').length;
    $('#cont-atraso').textContent = hoje.filter((p) => p.status === 'Atrasado').length;
    $('#ultimas').innerHTML = hoje.slice(0, 15).map((p) => {
      const a = D.S.alunos[p.rm] || p;
      return `<li class="item ${p.status === 'Atrasado' ? 'atraso' : 'ok'}">
        <div class="item-hora">${p.hora.slice(0, 5)}</div>
        <div class="item-corpo"><b>${esc(U.nomeProprio(p.nome))}</b><span>RM ${p.rm} · ${esc(U.rotuloTurma(a))}</span></div>
        <div class="item-fim">${p.enviado ? '' : '<span class="nuvem" title="Aguardando envio">⏳</span>'}<span class="selo ${p.status === 'Atrasado' ? 'atraso' : 'ok'}">${p.status}</span></div>
      </li>`;
    }).join('') || '<li class="vazio">Nenhuma entrada registrada hoje.</li>';
    atualizarStatus();
  }

  // ------------------------------------------------------------------ Turmas
  function preencherTurmas() {
    const opts = D.turmas().map(([k, r]) => `<option value="${esc(k)}">${esc(r)}</option>`).join('');
    ['#hoje-turma', '#alunos-turma'].forEach((s) => {
      const el = $(s), v = el.value;
      el.innerHTML = `<option value="">Todas as turmas</option>${opts}`;
      el.value = v; if (el.value !== v) el.value = '';
    });
  }

  // ------------------------------------------------------------------ Aba Dia
  function renderHoje() {
    if (!D.logado()) return;
    const data = $('#hoje-data').value || U.hojeStr();
    const turma = $('#hoje-turma').value;
    const alunos = D.alunosDaTurma(turma);
    const pres = D.presencasDoDia(data);
    const porRm = {}; pres.forEach((p) => { porRm[p.rm] = p; });
    const atrasados = alunos.filter((a) => porRm[a.rm] && porRm[a.rm].status === 'Atrasado').sort((a, b) => porRm[a.rm].hora < porRm[b.rm].hora ? -1 : 1);
    const presentes = alunos.filter((a) => porRm[a.rm] && porRm[a.rm].status !== 'Atrasado');
    const ausentes = alunos.filter((a) => !porRm[a.rm]);
    $('#seg-n-atrasados').textContent = atrasados.length;
    $('#seg-n-ausentes').textContent = ausentes.length;
    $('#seg-n-presentes').textContent = presentes.length;

    const lista = { atrasados, ausentes, presentes }[App.seg];
    const tipo = App.seg === 'atrasados' ? 'atraso' : App.seg === 'ausentes' ? 'falta' : null;
    const antesDoFechamento = data === U.hojeStr() && U.horaStr().slice(0, 5) <= CONFIG.HORARIO_LIMITE;
    $('#hoje-nota').textContent = App.seg === 'ausentes'
      ? (antesDoFechamento ? 'Atenção: o portão ainda está aberto — a lista de ausentes ainda vai mudar.' : 'Alunos ativos sem entrada registrada na portaria neste dia.')
      : '';

    const pendentes = tipo ? lista.filter((a) => !D.avisoEnviado(a.rm, tipo, data)).length : 0;
    const bl = $('#btn-lote');
    bl.hidden = !tipo || !lista.length;
    bl.textContent = pendentes ? `📲 Avisar responsáveis em fila (${pendentes} pendente${pendentes > 1 ? 's' : ''})` : '✔ Todos os responsáveis já foram avisados';
    bl.disabled = !pendentes;
    bl.onclick = () => W.abrirFila(lista.map((a) => ({ aluno: a, extra: { data, hora: porRm[a.rm] ? porRm[a.rm].hora : '' } })), tipo,
      tipo === 'atraso' ? `Avisos de atraso · ${U.fmtData(data)}` : `Avisos de falta · ${U.fmtData(data)}`);

    $('#lista-hoje').innerHTML = lista.map((a) => {
      const p = porRm[a.rm];
      const av = tipo ? D.avisoEnviado(a.rm, tipo, data) : null;
      return `<li class="item ${p ? (p.status === 'Atrasado' ? 'atraso' : 'ok') : 'falta'}" data-rm="${a.rm}">
        <div class="item-hora">${p ? p.hora.slice(0, 5) : '—'}</div>
        <div class="item-corpo"><b>${esc(U.nomeProprio(a.nome))}</b><span>RM ${a.rm} · ${esc(U.rotuloTurma(a))}</span>
          ${av ? `<span class="aviso-ok">✔ Aviso enviado ${U.fmtDataHora(av.enviadoEm)} · ${esc(av.operador)}</span>` : ''}</div>
        <div class="item-fim">${tipo ? `<button class="btn-whats-mini ${av ? 'feito' : ''}" data-whats="${a.rm}" ${a.telefone ? '' : 'title="Sem telefone"'}>${av ? '✔' : '📲'}</button>` : ''}</div>
      </li>`;
    }).join('') || `<li class="vazio">${App.seg === 'ausentes' && !alunos.length ? 'Importe a Relação de Alunos.' : 'Ninguém nesta lista.'}</li>`;

    $$('#lista-hoje [data-whats]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const a = D.S.alunos[b.dataset.whats];
      if (W.enviar(a, tipo, { data, hora: porRm[a.rm] ? porRm[a.rm].hora : '' })) renderHoje();
    }));
    $$('#lista-hoje .item').forEach((li) => li.addEventListener('click', () => abrirAluno(li.dataset.rm)));
  }

  // ------------------------------------------------------------------ Aba Alunos
  function renderAlunos() {
    if (!D.logado()) return;
    const q = U.norm($('#busca-aluno').value);
    const turma = $('#alunos-turma').value;
    let lista = D.alunosDaTurma(turma);
    if (q) lista = Object.values(D.S.alunos).filter((a) => a.rm.includes(q) || U.norm(a.nome).includes(q)).filter((a) => !turma || U.chaveTurma(a) === turma);
    $('#alunos-total').textContent = `${lista.length} aluno(s)`;
    $('#lista-alunos').innerHTML = lista.slice(0, 300).map((a) => {
      const f = D.S.freq[a.rm];
      const fa = f ? f.freqAcumulada : null;
      const cls = fa == null ? '' : fa >= CONFIG.FREQ_MINIMA ? 'ok' : fa >= 50 ? 'atraso' : 'falta';
      return `<li class="item" data-rm="${a.rm}">
        <div class="item-corpo"><b>${esc(U.nomeProprio(a.nome))}${a.ativo ? '' : ' <small>(inativo)</small>'}</b>
          <span>RM ${a.rm} · ${esc(U.rotuloTurma(a))}${a.telefone ? '' : ' · <i>sem telefone</i>'}</span></div>
        <div class="item-fim"><span class="selo ${cls}">${U.fmtPct(fa)}</span></div>
      </li>`;
    }).join('') || `<li class="vazio">${Object.keys(D.S.alunos).length ? 'Nenhum aluno encontrado.' : 'Nenhum aluno cadastrado. Use a aba Importar.'}</li>`;
    $$('#lista-alunos .item').forEach((li) => li.addEventListener('click', () => abrirAluno(li.dataset.rm)));
  }

  function loteFrequencia() {
    const turma = $('#alunos-turma').value;
    const lista = D.alunosDaTurma(turma).filter((a) => { const f = D.S.freq[a.rm]; return f && f.freqAcumulada != null && f.freqAcumulada < CONFIG.FREQ_MINIMA; });
    if (!lista.length) { U.toast(`Nenhum aluno abaixo de ${CONFIG.FREQ_MINIMA}% ${turma ? 'nesta turma' : ''}.`); return; }
    W.abrirFila(lista.map((a) => ({ aluno: a, extra: {} })), 'frequencia', `Frequência abaixo de ${CONFIG.FREQ_MINIMA}%`);
  }

  // ------------------------------------------------------------------ Ficha do aluno
  function abrirAluno(rm) {
    const a = D.S.alunos[rm]; if (!a) return;
    const f = D.S.freq[rm];
    const hoje = D.presencaDoDia(rm, U.hojeStr());
    const avisos = D.avisosDe(rm).slice(0, 5);
    const disc = f ? Object.entries(f.disciplinas || {}) : [];
    App.abrirPainel(`
      <h2>${esc(U.nomeProprio(a.nome))}</h2>
      <p class="dica">RM ${a.rm} · ${esc(U.rotuloTurma(a))} · ${esc(a.grupo || '')}${a.ativo ? '' : ' · <b>INATIVO</b>'}</p>
      <div class="hoje-aluno ${hoje ? (hoje.status === 'Atrasado' ? 'atraso' : 'ok') : 'falta'}">
        Hoje: ${hoje ? `${hoje.status} às ${hoje.hora.slice(0, 5)}` : 'sem entrada registrada'}
      </div>

      <h3>Responsável</h3>
      <form id="form-contato" class="grade-campos">
        <label class="larga">Nome do responsável <input id="ct-nome" value="${esc(a.nomeResponsavel || '')}"></label>
        <label class="larga">WhatsApp (com DDD) <input id="ct-tel" type="tel" inputmode="tel" value="${esc(a.telefone || '')}" placeholder="(11) 91234-5678"></label>
        <button class="btn btn-sec larga" type="submit">Salvar contato</button>
      </form>

      <h3>Frequência por componente</h3>
      ${f ? `<div class="freq-resumo">Acumulada: <b class="${f.freqAcumulada >= CONFIG.FREQ_MINIMA ? 'txt-ok' : 'txt-falta'}">${U.fmtPct(f.freqAcumulada)}</b> · ${f.faltasAcumuladas ?? '—'} faltas acumuladas</div>
      <div class="barras">${disc.map(([s, v]) => `<div class="barra"><span>${esc(s)}</span>
        <div class="trilho"><div class="${v == null ? '' : v >= CONFIG.FREQ_MINIMA ? 'ok' : v >= 50 ? 'atraso' : 'falta'}" style="width:${v == null ? 0 : v}%"></div></div>
        <em>${v == null ? '—' : U.fmtPct(v)}</em></div>`).join('')}</div>` : '<p class="dica">Sem Lista de Frequência importada.</p>'}

      ${avisos.length ? `<h3>Últimos avisos</h3><ul class="mini-lista">${avisos.map((v) => `<li>${W.ROTULO[v.tipo] || v.tipo} · ref. ${U.fmtData(v.dataReferencia)} · enviado ${U.fmtDataHora(v.enviadoEm)} (${esc(v.operador)})</li>`).join('')}</ul>` : ''}

      <div class="acoes-ficha">
        <button class="btn btn-primario" id="ficha-pdf">📄 Relatório PDF</button>
        <button class="btn btn-sec" id="ficha-xls">📊 Excel</button>
        ${hoje && hoje.status === 'Atrasado' ? '<button class="btn btn-whats" id="ficha-w-atraso">📲 Avisar atraso</button>' : ''}
        ${!hoje ? '<button class="btn btn-whats" id="ficha-w-falta">📲 Avisar falta</button>' : ''}
        ${f && f.freqAcumulada < CONFIG.FREQ_MINIMA ? '<button class="btn btn-whats" id="ficha-w-freq">📲 Avisar frequência</button>' : ''}
        ${!hoje && a.ativo ? '<button class="btn btn-sec" id="ficha-entrada">Registrar entrada agora</button>' : ''}
      </div>`);

    $('#form-contato').addEventListener('submit', (e) => {
      e.preventDefault();
      const tel = $('#ct-tel').value.trim();
      if (tel && !W.normalizarTelefone(tel)) { U.toast('Telefone inválido. Use DDD + número.', 'erro'); return; }
      D.salvarContato(rm, $('#ct-nome').value.trim(), tel);
      U.toast('Contato salvo ✔');
    });
    $('#ficha-pdf').addEventListener('click', () => PDF.aluno(rm));
    $('#ficha-xls').addEventListener('click', () => Excel.aluno(rm));
    const liga = (id, tipo) => { const b = $(id); if (b) b.addEventListener('click', () => W.enviar(D.S.alunos[rm], tipo, { data: U.hojeStr(), hora: hoje ? hoje.hora : '' }) && abrirAluno(rm)); };
    liga('#ficha-w-atraso', 'atraso'); liga('#ficha-w-falta', 'falta'); liga('#ficha-w-freq', 'frequencia');
    const be = $('#ficha-entrada');
    if (be) be.addEventListener('click', () => { fecharPainel(); lerCodigo(rm, 'manual'); });
  }

  // ------------------------------------------------------------------ Painel / menu
  App.abrirPainel = function (html, tamanho) {
    $('#painel-conteudo').innerHTML = html;
    $('#painel').classList.toggle('largo', tamanho === 'largo');
    $('#painel').hidden = false;
    $('.painel-caixa').scrollTop = 0;
    document.body.classList.add('travado');
  };
  function fecharPainel() { $('#painel').hidden = true; document.body.classList.remove('travado'); if (App.abaAtual === 'hoje') renderHoje(); }
  App.fecharPainel = fecharPainel;

  function abrirMenu() {
    const n = D.pendentes();
    App.abrirPainel(`
      <h2>${esc(D.S.sessao.nome)}</h2>
      <p class="dica">Usuário: ${esc(D.S.sessao.usuario)} · Perfil: ${esc(D.S.sessao.perfil)} · Aparelho: ${esc(D.S.dispositivo)}</p>
      <ul class="mini-lista">
        <li>Conexão: <b>${D.DEMO ? 'modo demonstração' : navigator.onLine && D.online ? 'online' : 'offline'}</b></li>
        <li>Registros aguardando envio: <b>${n}</b></li>
        <li>Última sincronização: <b>${D.S.ultimaSync ? U.fmtDataHora(D.S.ultimaSync) : '—'}</b></li>
        <li>Alunos na base: <b>${Object.keys(D.S.alunos).length}</b> · Turmas: <b>${D.turmas().length}</b></li>
        <li>Horário limite: <b>${CONFIG.HORARIO_LIMITE}</b></li>
      </ul>
      <button class="btn btn-primario btn-bloco" id="menu-sync">🔄 Sincronizar agora</button>
      ${D.admin() ? '<button class="btn btn-sec btn-bloco" id="menu-usuarios">👥 Usuários e senhas</button>' : ''}
      <button class="btn btn-sec btn-bloco" id="menu-senha">🔑 Alterar minha senha</button>
      <button class="btn btn-sec btn-bloco" id="menu-sair">Sair</button>
      <p class="dica">Instale no celular: Android → menu ⋮ → "Instalar app". iPhone (Safari) → Compartilhar → "Adicionar à Tela de Início".</p>`);
    $('#menu-sync').onclick = async () => { await D.carregarBase(true).catch(() => {}); await D.sincronizar(); U.toast('Sincronização concluída'); abrirMenu(); };
    $('#menu-senha').onclick = () => Usuarios.alterarSenha();
    if ($('#menu-usuarios')) $('#menu-usuarios').onclick = () => Usuarios.abrirGestao();
    $('#menu-sair').onclick = () => {
      if (n && !confirm(`Há ${n} registro(s) ainda não enviados. Eles continuam salvos neste aparelho e serão enviados no próximo login. Sair?`)) return;
      fecharPainel(); D.sair();
    };
  }

  // ------------------------------------------------------------------ Service worker
  function registrarSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) U.toast('Nova versão instalada. Feche e abra o app para atualizar.');
        });
      });
    }).catch((e) => console.warn('SW', e));
  }

  iniciar();
})();
