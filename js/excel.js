/* Exportação de relatórios em Excel (.xlsx) — SheetJS */
(function () {
  const X = {};

  function aba(linhas, larguras) {
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    if (larguras) ws['!cols'] = larguras.map((w) => ({ wch: w }));
    return ws;
  }
  function salvar(wb, nome) {
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    PDF.baixar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nome);
    U.toast('Planilha baixada ✔');
  }
  const pct = (v) => (v == null || v === '' ? '' : Number(v));
  const cab = (titulo) => [[`${CONFIG.ESCOLA.nome} – ${CONFIG.ESCOLA.extensao}`], [titulo], [`Emitido em ${U.fmtDataHora(U.agoraIso())}`], []];
  const txtAviso = (a) => (a ? `${U.fmtDataHora(a.enviadoEm)} (${a.operador})` : '');

  // ---------- Turma
  X.turma = async function (chave) {
    if (!chave) { U.toast('Escolha uma turma no filtro.', 'erro'); return; }
    const t = await PDF.calcTurma(chave);
    if (!t.linhas.length) { U.toast('Turma sem alunos.', 'erro'); return; }
    const a0 = t.alunos[0];
    const siglas = [...new Set(t.linhas.flatMap((l) => Object.keys(l.disciplinas)))];
    const linhas = cab(`Relatório da turma ${U.rotuloTurma(a0)} – ${a0.habilitacao} – Ano letivo ${t.ano}`).concat([
      ['Nº', 'RM', 'Nome', 'Grupo', ...siglas, 'Total aulas', 'Faltas período', 'Faltas acum.', 'Freq. acum. (%)', 'Situação', 'Entradas portaria', 'Atrasos', 'Sem entrada', 'Responsável', 'Telefone']
    ]);
    t.linhas.forEach((l, i) => linhas.push([
      i + 1, l.aluno.rm, l.aluno.nome, l.aluno.grupo || '', ...siglas.map((s) => pct(l.disciplinas[s])),
      l.totalAulas ?? '', l.totalFaltas ?? '', l.faltasAcumuladas ?? '', pct(l.freqAcumulada), PDF.situacao(l.freqAcumulada),
      l.entradas, l.atrasos, l.semEntrada, l.aluno.nomeResponsavel || '', l.aluno.telefone || ''
    ]));
    linhas.push([], [`Dias com portaria registrada no ano: ${t.dias.length}`]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, aba(linhas, [5, 8, 38, 9, ...siglas.map(() => 7), 10, 12, 11, 13, 14, 15, 8, 11, 28, 16]), 'Turma');
    salvar(wb, `Turma_${U.semAcento(U.rotuloTurma(a0)).replace(/\W+/g, '_')}.xlsx`);
  };

  // ---------- Dia
  X.dia = function (data, chaveTurma) {
    const r = PDF.calcDia(data, chaveTurma);
    if (!r.total.matriculados) { U.toast('Nenhum aluno cadastrado.', 'erro'); return; }
    const wb = XLSX.utils.book_new();
    const resumo = cab(`Relatório diário da portaria – ${U.diaSemana(data)}, ${U.fmtData(data)}`).concat([
      ['Turma', 'Ativos', 'Entraram', 'No horário', 'Atrasados', 'Sem entrada', '% presença']
    ]);
    r.porTurma.forEach((x) => resumo.push([x.rotulo, x.matriculados, x.presentes, x.noHorario, x.atrasados, x.ausentes, x.matriculados ? Math.round((x.presentes / x.matriculados) * 1000) / 10 : '']));
    const t = r.total;
    resumo.push(['TOTAL', t.matriculados, t.presentes, t.noHorario, t.atrasados, t.ausentes, t.matriculados ? Math.round((t.presentes / t.matriculados) * 1000) / 10 : '']);
    XLSX.utils.book_append_sheet(wb, aba(resumo, [36, 8, 10, 11, 11, 12, 11]), 'Resumo');
    XLSX.utils.book_append_sheet(wb, aba([['Hora', 'RM', 'Nome', 'Turma', 'Registrado por', 'Aviso enviado em']]
      .concat(r.atrasados.map((x) => [x.hora.slice(0, 5), x.aluno.rm, x.aluno.nome, U.rotuloTurma(x.aluno), x.operador || '', txtAviso(x.aviso)])), [7, 8, 38, 30, 14, 24]), 'Atrasados');
    XLSX.utils.book_append_sheet(wb, aba([['RM', 'Nome', 'Turma', 'Telefone responsável', 'Aviso enviado em']]
      .concat(r.ausentes.map((x) => [x.aluno.rm, x.aluno.nome, U.rotuloTurma(x.aluno), x.aluno.telefone || '', txtAviso(x.aviso)])), [8, 38, 30, 18, 24]), 'Sem entrada');
    XLSX.utils.book_append_sheet(wb, aba([['Hora', 'RM', 'Nome', 'Turma']]
      .concat(r.noHorario.sort((a, b) => (a.hora < b.hora ? -1 : 1)).map((x) => [x.hora.slice(0, 5), x.aluno.rm, x.aluno.nome, U.rotuloTurma(x.aluno)])), [7, 8, 38, 30]), 'No horário');
    salvar(wb, `Portaria_${data}.xlsx`);
  };

  // ---------- Aluno
  X.aluno = async function (rm) {
    const a = D.S.alunos[rm]; if (!a) return;
    const f = D.S.freq[rm] || {};
    const h = await D.historicoAluno(rm);
    const wb = XLSX.utils.book_new();
    const dados = cab(`Relatório individual – Ano letivo ${new Date().getFullYear()}`).concat([
      ['Nome', a.nome], ['RM', a.rm], ['Habilitação', a.habilitacao], ['Série', a.serie], ['Turma', a.turma], ['Grupo', a.grupo || ''],
      ['Responsável', a.nomeResponsavel || ''], ['Telefone', a.telefone || ''], [],
      ['Total de aulas (período)', f.totalAulas ?? ''], ['Faltas no período', f.totalFaltas ?? ''], ['Faltas acumuladas', f.faltasAcumuladas ?? ''],
      ['Frequência acumulada (%)', pct(f.freqAcumulada)], ['Situação', PDF.situacao(f.freqAcumulada)], [],
      ['Componente', 'Frequência (%)', 'Situação']
    ]);
    Object.entries(f.disciplinas || {}).forEach(([s, v]) => dados.push([s, v == null ? 'sem lançamento' : v, PDF.situacao(v)]));
    XLSX.utils.book_append_sheet(wb, aba(dados, [26, 40, 16]), 'Aluno');
    const porDia = {}; h.presencas.forEach((p) => { porDia[p.data] = p; });
    const av = (tipo, d) => h.avisos.find((x) => x.tipo === tipo && x.dataReferencia === d);
    const port = [['Data', 'Dia', 'Situação', 'Hora', 'Aviso enviado em']];
    h.diasLetivos.filter((d) => d <= U.hojeStr()).sort().reverse().forEach((d) => {
      const p = porDia[d];
      port.push([U.fmtData(d), U.diaSemana(d), p ? p.status : 'Sem entrada', p ? p.hora.slice(0, 5) : '', txtAviso(p ? (p.status === 'Atrasado' ? av('atraso', d) : null) : av('falta', d))]);
    });
    XLSX.utils.book_append_sheet(wb, aba(port, [12, 10, 14, 8, 24]), 'Portaria');
    salvar(wb, `Aluno_${a.rm}_${U.semAcento(a.nome).replace(/\W+/g, '_')}.xlsx`);
  };

  // ---------- Modelo de contatos (já preenchido com os alunos)
  X.modeloContatos = function () {
    const alunos = Object.values(D.S.alunos).filter((a) => a.ativo)
      .sort((x, y) => U.rotuloTurma(x).localeCompare(U.rotuloTurma(y), 'pt-BR') || x.nome.localeCompare(y.nome, 'pt-BR'));
    const linhas = [['RM', 'NOME', 'TURMA', 'RESPONSAVEL', 'TELEFONE']];
    if (alunos.length) alunos.forEach((a) => linhas.push([a.rm, a.nome, U.rotuloTurma(a), a.nomeResponsavel || '', a.telefone || '']));
    else linhas.push(['27000', 'NOME DO ALUNO (exemplo)', '1º ADMINISTRAÇÃO – Turma A', 'NOME DO RESPONSÁVEL', '(11) 91234-5678']);
    const ws = aba(linhas, [9, 40, 30, 36, 18]);
    ws['!autofilter'] = { ref: `A1:E${linhas.length}` };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contatos');
    salvar(wb, 'Modelo_Contatos_Responsaveis.xlsx');
  };

  window.Excel = X;
})();
