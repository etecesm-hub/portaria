/* WhatsApp via wa.me — envio individual e fila em lote, com registro de "Aviso enviado" */
(function () {
  const W = {};
  const ROTULO = { atraso: 'Atraso', falta: 'Falta', frequencia: 'Frequência baixa' };
  W.ROTULO = ROTULO;

  /** Retorna só dígitos com DDI 55, ou '' se inválido */
  W.normalizarTelefone = function (t) {
    let d = String(t || '').replace(/\D/g, '');
    if (!d) return '';
    d = d.replace(/^0+/, '');
    if (d.length === 10 || d.length === 11) d = '55' + d;
    if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
    return '';
  };
  W.fmtTelefone = function (t) {
    const d = W.normalizarTelefone(t);
    if (!d) return t || '';
    const n = d.slice(2);
    return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  };

  W.mensagem = function (tipo, aluno, extra) {
    extra = extra || {};
    const f = D.S.freq[aluno.rm] || {};
    const vars = {
      responsavel: aluno.nomeResponsavel ? U.nomeProprio(aluno.nomeResponsavel).split(' ')[0] : 'responsável',
      aluno: U.nomeProprio(aluno.nome),
      primeiroNome: U.primeiroNome(aluno.nome),
      rm: aluno.rm,
      turma: U.rotuloTurma(aluno),
      data: U.fmtData(extra.data || U.hojeStr()),
      hora: (extra.hora || '').slice(0, 5),
      limite: CONFIG.HORARIO_LIMITE,
      freq: f.freqAcumulada != null ? Number(f.freqAcumulada).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—',
      faltas: f.faltasAcumuladas != null ? f.faltasAcumuladas : '—',
      escola: `${CONFIG.ESCOLA.nome} – ${CONFIG.ESCOLA.extensao}`,
      telefoneEscola: CONFIG.ESCOLA.telefone
    };
    return CONFIG.MENSAGENS[tipo].replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  };

  W.link = (telefone, texto) => `https://wa.me/${W.normalizarTelefone(telefone)}?text=${encodeURIComponent(texto)}`;

  /** Abre o WhatsApp e registra o aviso. Deve ser chamado direto no clique (gesto do usuário). */
  W.enviar = function (aluno, tipo, extra, semConfirmar) {
    const tel = W.normalizarTelefone(aluno.telefone);
    if (!tel) { U.toast('Aluno sem telefone do responsável. Cadastre em Alunos.', 'erro'); return false; }
    const dataRef = tipo === 'frequencia' ? U.hojeStr() : (extra && extra.data) || U.hojeStr();
    const ja = D.avisoEnviado(aluno.rm, tipo, dataRef);
    if (ja && !semConfirmar && !confirm(`Aviso de ${ROTULO[tipo]} já enviado em ${U.fmtDataHora(ja.enviadoEm)} por ${ja.operador}. Enviar de novo?`)) return false;
    const url = W.link(tel, W.mensagem(tipo, aluno, extra));
    const janela = window.open(url, '_blank'); // sem 'noopener': com ele o retorno é sempre null
    if (!janela) location.href = url;
    D.registrarAviso(aluno, tipo, dataRef, tel);
    return true;
  };

  /** Fila sequencial: um toque por mensagem (navegadores bloqueiam abrir várias de uma vez) */
  W.abrirFila = function (itens, tipo, titulo) {
    // itens: [{aluno, extra}]
    const fila = itens.filter((i) => !D.avisoEnviado(i.aluno.rm, tipo, tipo === 'frequencia' ? U.hojeStr() : i.extra.data));
    const semTel = fila.filter((i) => !W.normalizarTelefone(i.aluno.telefone));
    const validos = fila.filter((i) => W.normalizarTelefone(i.aluno.telefone));
    let pos = 0, enviados = 0;

    function render() {
      const c = U.$('#painel-conteudo');
      if (pos >= validos.length) {
        c.innerHTML = `<h2>${U.esc(titulo)}</h2>
          <div class="fila-fim">✅ Fila concluída<br><b>${enviados}</b> aviso(s) registrado(s).</div>
          ${semTel.length ? `<p class="dica">${semTel.length} aluno(s) sem telefone: ${semTel.map((i) => U.esc(U.nomeProprio(i.aluno.nome))).join(', ')}.</p>` : ''}
          <button class="btn btn-primario btn-bloco" data-fechar>Fechar</button>`;
        return;
      }
      const it = validos[pos];
      c.innerHTML = `<h2>${U.esc(titulo)}</h2>
        <div class="fila-progresso"><div style="width:${(pos / validos.length) * 100}%"></div></div>
        <p class="dica">${pos + 1} de ${validos.length}${semTel.length ? ` · ${semTel.length} sem telefone` : ''}</p>
        <div class="fila-item">
          <b>${U.esc(U.nomeProprio(it.aluno.nome))}</b>
          <span>RM ${it.aluno.rm} · ${U.esc(U.rotuloTurma(it.aluno))}</span>
          <span>📱 ${U.esc(W.fmtTelefone(it.aluno.telefone))}${it.aluno.nomeResponsavel ? ' · ' + U.esc(U.nomeProprio(it.aluno.nomeResponsavel)) : ''}</span>
          <pre class="fila-msg">${U.esc(W.mensagem(tipo, it.aluno, it.extra))}</pre>
        </div>
        <button class="btn btn-whats btn-grande btn-bloco" id="fila-enviar">Abrir WhatsApp e marcar enviado</button>
        <button class="btn btn-sec btn-bloco" id="fila-pular">Pular este</button>`;
      U.$('#fila-enviar').onclick = () => { if (W.enviar(it.aluno, tipo, it.extra, true)) enviados++; pos++; render(); };
      U.$('#fila-pular').onclick = () => { pos++; render(); };
    }
    if (!fila.length) { U.toast('Todos já foram avisados ✔'); return; }
    App.abrirPainel('');
    render();
  };

  window.W = W;
})();
