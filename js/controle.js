/* Relatório "Controle de Entrada": grade aluno × data com o horário de entrada colorido
   verde = até o horário limite · amarelo = atrasado · vermelho = FALTA (sem registro).
   Uma folha (ou mais, se houver muitas datas) por turma. */
(function () {
  const C = {};
  const DATAS_POR_FOLHA = 12;
  // Cores no padrão de destaque do Excel (boas para imprimir)
  const COR = {
    ok: { fundo: [198, 239, 206], texto: [0, 97, 0], hexF: 'C6EFCE', hexT: '006100' },
    atraso: { fundo: [255, 235, 156], texto: [156, 87, 0], hexF: 'FFEB9C', hexT: '9C5700' },
    falta: { fundo: [255, 199, 206], texto: [156, 0, 6], hexF: 'FFC7CE', hexT: '9C0006' }
  };
  const ddmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const nomeArq = (s) => U.semAcento(s).replace(/\W+/g, '_');

  /** Monta a grade de cada turma: datas = dias do período em que a turma teve ao menos uma entrada */
  C.calcular = async function (chaves, inicio, fim) {
    const per = await D.presencasPeriodo(inicio, fim);
    const porRmData = {};
    per.presencas.forEach((p) => {
      if (p.status === 'Cancelado') return;
      const k = p.rm + '|' + p.data;
      if (!porRmData[k] || p.hora < porRmData[k].hora) porRmData[k] = p; // vale a primeira entrada do dia
    });
    return chaves.map((chave) => {
      const alunos = D.alunosDaTurma(chave);
      const rms = new Set(alunos.map((a) => a.rm));
      const datas = [...new Set(Object.values(porRmData).filter((p) => rms.has(p.rm)).map((p) => p.data))].sort();
      const linhas = alunos.map((a) => {
        const celulas = datas.map((d) => {
          const p = porRmData[a.rm + '|' + d];
          if (!p) return { tipo: 'falta', txt: 'FALTA' };
          return { tipo: p.status === 'Atrasado' ? 'atraso' : 'ok', txt: p.hora.slice(0, 5) };
        });
        const conta = (t) => celulas.filter((c) => c.tipo === t).length;
        return { aluno: a, celulas, ok: conta('ok'), atraso: conta('atraso'), falta: conta('falta') };
      });
      const entraram = datas.map((_, i) => linhas.filter((l) => l.celulas[i].tipo !== 'falta').length);
      return { chave, rotulo: U.rotuloTurma(alunos[0]), habilitacao: alunos[0] ? alunos[0].habilitacao : '', alunos, datas, linhas, entraram };
    }).filter((t) => t.alunos.length);
  };

  // ======================================================================
  // PDF — A4 deitado, uma folha por turma (repete se passar de 12 datas)
  // ======================================================================
  C.pdf = async function (chaves, inicio, fim) {
    U.toast('Gerando Controle de Entrada…');
    const turmas = await C.calcular(chaves, inicio, fim);
    if (!turmas.length) { U.toast('Nenhuma turma com alunos.', 'erro'); return; }
    const I = PDF.interno, K = I.cores;
    await I.carregarLogos();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    let primeira = true;

    turmas.forEach((t) => {
      const blocos = [];
      for (let i = 0; i < Math.max(1, t.datas.length); i += DATAS_POR_FOLHA) blocos.push(i);
      blocos.forEach((ini, b) => {
        if (!primeira) doc.addPage();
        primeira = false;
        const datas = t.datas.slice(ini, ini + DATAS_POR_FOLHA);
        const parte = blocos.length > 1 ? ` · Folha ${b + 1} de ${blocos.length}` : '';
        let y = I.cabecalho(doc, 'RELAÇÃO DE ALUNOS – CONTROLE DE ENTRADA',
          `${t.rotulo} · Período: ${U.fmtData(inicio)} a ${U.fmtData(fim)} · Portão fecha às ${CONFIG.HORARIO_LIMITE}${parte}`);

        if (!datas.length) {
          doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(...K.CINZA);
          doc.text('Nenhuma entrada registrada para esta turma no período escolhido.', 15, y + 6);
          return;
        }
        const head = [['Nº', 'RM', 'Nome', ...datas.map(ddmm), 'No\nhorário', 'Atra-\nsos', 'Faltas']];
        const body = t.linhas.map((l, i) => [i + 1, l.aluno.rm, l.aluno.nome,
          ...l.celulas.slice(ini, ini + DATAS_POR_FOLHA).map((c) => ({ content: c.txt, tipo: c.tipo })),
          l.ok, l.atraso, l.falta]);
        const foot = [[{ content: 'Entraram no dia', colSpan: 3, styles: { halign: 'right' } },
          ...t.entraram.slice(ini, ini + DATAS_POR_FOLHA).map((n) => `${n}/${t.alunos.length}`), '', '', '']];
        const nD = datas.length;
        const largData = Math.min(16, (297 - 20 - 7 - 12 - 60 - 3 * 11) / nD);
        const colStyles = { 0: { cellWidth: 7, halign: 'center' }, 1: { cellWidth: 12, halign: 'center' }, 2: { cellWidth: 'auto', overflow: 'ellipsize' } };
        datas.forEach((_, i) => { colStyles[3 + i] = { cellWidth: largData, halign: 'center', fontStyle: 'bold' }; });
        [0, 1, 2].forEach((k) => { colStyles[3 + nD + k] = { cellWidth: 11, halign: 'center' }; });

        doc.autoTable({
          startY: y - 1, margin: { left: 10, right: 10, bottom: 16 }, theme: 'grid',
          head, body, foot, showFoot: 'lastPage',
          headStyles: { fillColor: K.CINZA, textColor: 255, fontSize: 7.2, halign: 'center', valign: 'middle', cellPadding: 0.8 },
          footStyles: { fillColor: K.CLARO, textColor: K.TXT, fontSize: 7, cellPadding: 0.6, halign: 'center', fontStyle: 'bold' },
          styles: { fontSize: 7.2, cellPadding: { top: 0.55, bottom: 0.55, left: 0.9, right: 0.9 }, textColor: K.TXT, lineColor: [205, 210, 212], lineWidth: 0.15, valign: 'middle' },
          columnStyles: colStyles,
          didParseCell: (d) => {
            if (d.section !== 'body') return;
            const tipo = d.cell.raw && d.cell.raw.tipo;
            if (tipo) { d.cell.styles.fillColor = COR[tipo].fundo; d.cell.styles.textColor = COR[tipo].texto; }
            const c = d.column.index - 3 - nD;
            if (c === 1 && d.cell.raw > 0) d.cell.styles.textColor = COR.atraso.texto;
            if (c === 2 && d.cell.raw > 0) { d.cell.styles.textColor = COR.falta.texto; d.cell.styles.fontStyle = 'bold'; }
          }
        });
        legenda(doc, doc.lastAutoTable.finalY + 4.5, K);
      });
    });
    I.rodapes(doc);
    const nome = turmas.length === 1 ? nomeArq(turmas[0].rotulo) : 'Todas_as_turmas';
    PDF.mostrar(doc, `Controle_Entrada_${nome}_${inicio}_a_${fim}.pdf`);
  };

  function legenda(doc, y, K) {
    const H = doc.internal.pageSize.getHeight();
    if (y > H - 20) return;
    let x = 10;
    doc.setFontSize(7.5);
    [['ok', `Entrou até ${CONFIG.HORARIO_LIMITE} (horário de entrada)`], ['atraso', `Entrou depois de ${CONFIG.HORARIO_LIMITE} (atrasado)`], ['falta', 'FALTA – sem registro de entrada na portaria']]
      .forEach(([t, txt]) => {
        doc.setFillColor(...COR[t].fundo); doc.setDrawColor(...COR[t].texto); doc.setLineWidth(0.2);
        doc.rect(x, y - 3, 6, 4, 'FD');
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...K.TXT);
        doc.text(txt, x + 8, y);
        x += doc.getTextWidth(txt) + 18;
      });
    doc.setFont('helvetica', 'italic'); doc.setFontSize(6.8); doc.setTextColor(...K.CINZA);
    doc.text('Aparecem só os dias em que a portaria registrou entrada de alunos da turma. Registros cancelados não são considerados.', 10, y + 4.5);
  }

  // ======================================================================
  // EXCEL — mesma grade, com as cores (biblioteca xlsx-js-style, carregada só aqui)
  // ======================================================================
  const URL_XLSX_ESTILO = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
  function carregarXlsxEstilo() {
    if (window.XLSXEstilo) return Promise.resolve(window.XLSXEstilo);
    return new Promise((ok, erro) => {
      const original = window.XLSX;
      const s = document.createElement('script');
      s.src = URL_XLSX_ESTILO;
      s.onload = () => { window.XLSXEstilo = window.XLSX; window.XLSX = original; ok(window.XLSXEstilo); };
      s.onerror = () => { window.XLSX = original; erro(new Error('Não foi possível carregar o gerador de Excel (sem internet?).')); };
      document.head.appendChild(s);
    });
  }

  C.excel = async function (chaves, inicio, fim) {
    let XS;
    try { XS = await carregarXlsxEstilo(); } catch (e) { U.toast(e.message, 'erro'); return; }
    const turmas = await C.calcular(chaves, inicio, fim);
    if (!turmas.length) { U.toast('Nenhuma turma com alunos.', 'erro'); return; }
    const borda = { style: 'thin', color: { rgb: 'CDD2D4' } };
    const bordas = { top: borda, bottom: borda, left: borda, right: borda };
    const est = (extra) => Object.assign({ border: bordas, alignment: { horizontal: 'center', vertical: 'center' }, font: { sz: 10 } }, extra || {});
    const wb = XS.utils.book_new();
    const usadas = new Set();

    turmas.forEach((t) => {
      const titulo = [
        [{ v: `${CONFIG.ESCOLA.nome} – ${CONFIG.ESCOLA.extensao}`, s: { font: { bold: true, sz: 11 } } }],
        [{ v: `Relação de Alunos – Controle de Entrada – ${t.rotulo}`, s: { font: { bold: true, sz: 13, color: { rgb: 'B2140F' } } } }],
        [{ v: `Período: ${U.fmtData(inicio)} a ${U.fmtData(fim)} · Portão fecha às ${CONFIG.HORARIO_LIMITE} · Emitido em ${U.fmtDataHora(U.agoraIso())}`, s: { font: { sz: 9, color: { rgb: '45555C' } } } }],
        []
      ];
      const cab = est({ font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '45555C' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } });
      const linhaCab = ['Nº', 'RM', 'Nome', ...t.datas.map(ddmm), 'No horário', 'Atrasos', 'Faltas'].map((v) => ({ v, s: cab }));
      const linhas = t.linhas.map((l, i) => [
        { v: i + 1, s: est() }, { v: l.aluno.rm, t: 's', s: est() }, { v: l.aluno.nome, s: est({ alignment: { horizontal: 'left', vertical: 'center' } }) },
        ...l.celulas.map((c) => ({ v: c.txt, t: 's', s: est({ fill: { fgColor: { rgb: COR[c.tipo].hexF } }, font: { bold: true, sz: 10, color: { rgb: COR[c.tipo].hexT } } }) })),
        { v: l.ok, s: est() },
        { v: l.atraso, s: est(l.atraso ? { font: { sz: 10, color: { rgb: COR.atraso.hexT } } } : {}) },
        { v: l.falta, s: est(l.falta ? { font: { bold: true, sz: 10, color: { rgb: COR.falta.hexT } } } : {}) }
      ]);
      const rod = est({ font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'F2F4F5' } } });
      const rodape = [{ v: '', s: rod }, { v: '', s: rod }, { v: 'Entraram no dia', s: Object.assign({}, rod, { alignment: { horizontal: 'right' } }) },
        ...t.entraram.map((n) => ({ v: `${n}/${t.alunos.length}`, s: rod })), { v: '', s: rod }, { v: '', s: rod }, { v: '', s: rod }];
      const legenda = [[], ...[['ok', `Entrou até ${CONFIG.HORARIO_LIMITE}`], ['atraso', `Entrou depois de ${CONFIG.HORARIO_LIMITE} (atrasado)`], ['falta', 'FALTA – sem registro de entrada']]
        .map(([k, txt]) => [{ v: '', s: { fill: { fgColor: { rgb: COR[k].hexF } }, border: bordas } }, { v: txt }])];
      const dados = titulo.concat([linhaCab], linhas, t.datas.length ? [rodape] : [[{ v: 'Nenhuma entrada registrada no período.' }]], legenda);
      const ws = XS.utils.aoa_to_sheet(dados);
      ws['!cols'] = [{ wch: 5 }, { wch: 8 }, { wch: 40 }, ...t.datas.map(() => ({ wch: 8 })), { wch: 10 }, { wch: 9 }, { wch: 8 }];
      ws['!rows'] = []; ws['!rows'][4] = { hpt: 30 };
      ws['!freeze'] = { xSplit: 3, ySplit: 5 };
      let nome = `${t.rotulo}`.replace(/[\\/?*[\]:]/g, '').slice(0, 28);
      while (usadas.has(nome)) nome = nome.slice(0, 26) + '_' + usadas.size;
      usadas.add(nome);
      XS.utils.book_append_sheet(wb, ws, nome);
    });
    const buf = XS.write(wb, { bookType: 'xlsx', type: 'array' });
    const nome = turmas.length === 1 ? nomeArq(turmas[0].rotulo) : 'Todas_as_turmas';
    PDF.baixar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Controle_Entrada_${nome}_${inicio}_a_${fim}.xlsx`);
    U.toast('Planilha baixada ✔');
  };

  // ======================================================================
  // Janela de escolha (turma + período)
  // ======================================================================
  C.abrir = function (turmaFiltro) {
    const turmas = D.turmas();
    const hoje = U.hojeStr();
    const inicioMes = hoje.slice(0, 8) + '01';
    App.abrirPainel(`
      <h2>Controle de Entrada</h2>
      <p class="dica">Grade com o horário de entrada de cada aluno por dia:
        <b style="color:#006100">verde</b> até ${CONFIG.HORARIO_LIMITE}, <b style="color:#9C5700">amarelo</b> atrasado e
        <b style="color:#9C0006">vermelho = FALTA</b>. Uma folha por turma.</p>
      <form id="form-controle">
        <label>Turma
          <select id="ce-turma">
            <option value="">Todas as turmas (uma folha para cada)</option>
            ${turmas.map(([k, r]) => `<option value="${U.esc(k)}" ${k === turmaFiltro ? 'selected' : ''}>${U.esc(r)}</option>`).join('')}
          </select></label>
        <label>De <input type="date" id="ce-inicio" value="${inicioMes}" max="${hoje}" required></label>
        <label>Até <input type="date" id="ce-fim" value="${hoje}" max="${hoje}" required></label>
        <p class="dica">Só aparecem os dias em que a portaria registrou entradas da turma.</p>
        <button class="btn btn-primario btn-bloco" type="submit" data-tipo="pdf">📄 Gerar PDF</button>
        <button class="btn btn-sec btn-bloco" type="submit" data-tipo="xls">📊 Gerar Excel</button>
      </form>`);
    U.$('#form-controle').addEventListener('submit', (e) => {
      e.preventDefault();
      const tipo = e.submitter ? e.submitter.dataset.tipo : 'pdf';
      const ini = U.$('#ce-inicio').value, fim = U.$('#ce-fim').value;
      if (!ini || !fim || ini > fim) { U.toast('Confira o período (data inicial antes da final).', 'erro'); return; }
      const t = U.$('#ce-turma').value;
      const chaves = t ? [t] : turmas.map(([k]) => k);
      if (tipo === 'xls') C.excel(chaves, ini, fim); else C.pdf(chaves, ini, fim);
    });
  };

  window.Controle = C;
})();
