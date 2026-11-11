/* PDFs institucionais — padrão visual Centro Paula Souza / Etec da Zona Leste */
(function () {
  const PDF = {};
  const VERM = [178, 20, 15], CINZA = [69, 85, 92], CLARO = [242, 244, 245], TXT = [33, 37, 41];
  const VERDE = [30, 126, 52], AMBAR = [176, 106, 0];
  let logos = null;

  async function carregarLogos() {
    if (logos) return logos;
    const ler = async (src) => {
      const b = await (await fetch(src)).blob();
      return new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
    };
    try { logos = { etec: await ler('icons/logo-etec.png'), cps: await ler('icons/logo-cps.png') }; }
    catch (e) { logos = {}; }
    return logos;
  }

  function situacao(v) {
    if (v == null) return { txt: 'Sem lançamento', cor: CINZA };
    if (v >= CONFIG.FREQ_MINIMA) return { txt: 'Regular', cor: VERDE };
    if (v >= 50) return { txt: 'Atenção', cor: AMBAR };
    return { txt: 'Crítica', cor: VERM };
  }

  function novoDoc() {
    const { jsPDF } = window.jspdf;
    return new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  }

  /** Cabeçalho institucional. Retorna o Y onde o conteúdo começa. */
  function cabecalho(doc, titulo, subtitulo) {
    const W = doc.internal.pageSize.getWidth();
    if (logos.etec) doc.addImage(logos.etec, 'PNG', 15, 10, 16 * 651 / 430, 16);
    if (logos.cps) doc.addImage(logos.cps, 'PNG', W - 15 - 16 * 790 / 519, 10, 16 * 790 / 519, 16);
    doc.setTextColor(...TXT);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.text(CONFIG.ESCOLA.mantenedora, W / 2, 14, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`${CONFIG.ESCOLA.nome} – ${CONFIG.ESCOLA.extensao}`, W / 2, 18.5, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...CINZA);
    const end = doc.splitTextToSize(CONFIG.ESCOLA.endereco, 118).slice(0, 2);
    doc.text(end, W / 2, 22.6, { align: 'center' });
    doc.text(`Telefone: ${CONFIG.ESCOLA.telefone}`, W / 2, 22.6 + end.length * 2.9, { align: 'center' });
    doc.setDrawColor(...VERM); doc.setLineWidth(0.9); doc.line(15, 31.5, W - 15, 31.5);
    doc.setDrawColor(...CINZA); doc.setLineWidth(0.2); doc.line(15, 32.6, W - 15, 32.6);

    doc.setTextColor(...TXT); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(titulo, W / 2, 41, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...CINZA);
    doc.text(subtitulo, W / 2, 46, { align: 'center' });
    return 51;
  }

  function rodapes(doc) {
    const n = doc.getNumberOfPages(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setDrawColor(...CINZA); doc.setLineWidth(0.2); doc.line(15, H - 13, W - 15, H - 13);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...CINZA);
      doc.text(`${CONFIG.ESCOLA.nome} – ${CONFIG.ESCOLA.extensao} · Sistema de Controle de Portaria · Emitido em ${U.fmtDataHora(U.agoraIso())}`, 15, H - 9);
      doc.text(`Página ${i} de ${n}`, W - 15, H - 9, { align: 'right' });
    }
  }

  function secao(doc, y, texto) {
    const W = doc.internal.pageSize.getWidth();
    y = garantir(doc, y, 20);
    doc.setFillColor(...VERM); doc.rect(15, y, 1.6, 5.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...TXT);
    doc.text(texto.toUpperCase(), 19, y + 4.3);
    doc.setDrawColor(220, 224, 226); doc.setLineWidth(0.2); doc.line(19, y + 6.6, W - 15, y + 6.6);
    return y + 10;
  }

  function garantir(doc, y, altura) {
    const H = doc.internal.pageSize.getHeight();
    if (y + altura > H - 18) { doc.addPage(); return 18; }
    return y;
  }

  /** Caixas de indicadores lado a lado */
  function indicadores(doc, y, itens) {
    const W = doc.internal.pageSize.getWidth();
    const gap = 3, larg = (W - 30 - gap * (itens.length - 1)) / itens.length, alt = 17;
    y = garantir(doc, y, alt + 4);
    itens.forEach((it, i) => {
      const x = 15 + i * (larg + gap);
      doc.setFillColor(...CLARO); doc.setDrawColor(222, 226, 228); doc.roundedRect(x, y, larg, alt, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(itens.length > 5 ? 11.5 : 14); doc.setTextColor(...(it.cor || TXT));
      doc.text(String(it.valor), x + larg / 2, y + 8.3, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...CINZA);
      doc.text(it.rotulo, x + larg / 2, y + 13.5, { align: 'center' });
    });
    return y + alt + 5;
  }

  function assinaturas(doc, y, nomes) {
    const W = doc.internal.pageSize.getWidth();
    y = garantir(doc, y, 42);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...TXT);
    doc.text(`${CONFIG.ESCOLA.cidade}, ${U.dataExtenso(new Date())}.`, W - 15, y + 4, { align: 'right' });
    y += 24;
    const larg = (W - 30 - 10 * (nomes.length - 1)) / nomes.length;
    nomes.forEach((n, i) => {
      const x = 15 + i * (larg + 10);
      doc.setDrawColor(...TXT); doc.setLineWidth(0.3); doc.line(x, y, x + larg, y);
      doc.setFontSize(8); doc.text(n, x + larg / 2, y + 4.5, { align: 'center' });
    });
    return y + 10;
  }

  PDF.baixar = function (blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  /** Mostra o PDF dentro do app (pdf.js) com opções de baixar e compartilhar */
  async function salvar(doc, nome) {
    const blob = doc.output('blob');
    PDF.ultimo = { blob, nome };
    if (!window.pdfjsLib) { PDF.baixar(blob, nome); return; } // sem visualizador: baixa direto
    const arquivo = new File([blob], nome, { type: 'application/pdf' });
    const podeCompartilhar = !!(navigator.canShare && navigator.canShare({ files: [arquivo] }));
    App.abrirPainel(`
      <h2>Pré-visualização</h2>
      <p class="dica">${U.esc(nome)}</p>
      <div class="acoes-ficha acoes-pdf">
        <button class="btn btn-primario" id="pdf-baixar">⬇ Baixar PDF</button>
        ${podeCompartilhar ? '<button class="btn btn-whats" id="pdf-compartilhar">↗ Compartilhar</button>' : ''}
      </div>
      <div id="pdf-paginas" class="pdf-paginas"><p class="dica">Carregando…</p></div>`, 'largo');
    U.$('#pdf-baixar').onclick = () => PDF.baixar(blob, nome);
    const bc = U.$('#pdf-compartilhar');
    if (bc) bc.onclick = () => navigator.share({ files: [arquivo], title: nome }).catch(() => {});
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      const box = U.$('#pdf-paginas');
      if (!box) return;
      box.innerHTML = '';
      const larg = Math.min(box.clientWidth || 600, 900);
      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i);
        const base = pg.getViewport({ scale: 1 });
        const vp = pg.getViewport({ scale: (larg / base.width) * Math.min(window.devicePixelRatio || 1, 2) });
        const c = document.createElement('canvas');
        c.width = vp.width; c.height = vp.height;
        box.appendChild(c);
        await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      }
    } catch (e) {
      console.warn(e);
      const box = U.$('#pdf-paginas');
      if (box) box.innerHTML = '<p class="dica">Não foi possível mostrar a prévia. Use "Baixar PDF".</p>';
    }
  }

  // ======================================================================
  // RELATÓRIO INDIVIDUAL
  // ======================================================================
  PDF.aluno = async function (rm) {
    const aluno = D.S.alunos[rm];
    if (!aluno) return;
    U.toast('Gerando PDF…');
    await carregarLogos();
    const hist = await D.historicoAluno(rm);
    const f = D.S.freq[rm];
    const doc = novoDoc();
    const ano = new Date().getFullYear();
    let y = cabecalho(doc, 'RELATÓRIO INDIVIDUAL DE FREQUÊNCIA', `Ano letivo ${ano} · ${U.curso(aluno.habilitacao) || ''}`);

    // ---------- Dados do aluno
    y = secao(doc, y, 'Dados do aluno');
    const lab = { fillColor: CLARO, fontStyle: 'bold', textColor: CINZA, cellWidth: 30 };
    doc.autoTable({
      startY: y, theme: 'grid', margin: { left: 15, right: 15 },
      styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: [222, 226, 228], lineWidth: 0.2, textColor: TXT },
      body: [
        [{ content: 'Nome', styles: lab }, { content: aluno.nome, colSpan: 3, styles: { fontStyle: 'bold' } }],
        [{ content: 'RM', styles: lab }, aluno.rm, { content: 'Série / Módulo', styles: lab }, `${aluno.serie}ª série`],
        [{ content: 'Habilitação', styles: lab }, { content: aluno.habilitacao || '—', colSpan: 3 }],
        [{ content: 'Turma', styles: lab }, aluno.turma || '—', { content: 'Grupo', styles: lab }, aluno.grupo || '—'],
        [{ content: 'Responsável', styles: lab }, aluno.nomeResponsavel ? U.nomeProprio(aluno.nomeResponsavel) : '—', { content: 'Telefone', styles: lab }, aluno.telefone ? W.fmtTelefone(aluno.telefone) : '—']
      ]
    });
    y = doc.lastAutoTable.finalY + 6;

    // ---------- Frequência por componente
    y = secao(doc, y, '1. Frequência por componente curricular');
    if (f) {
      const linhas = Object.entries(f.disciplinas || {}).map(([sigla, v]) => {
        const s = situacao(v);
        return [sigla, v == null ? '—' : U.fmtPct(v), { content: s.txt, styles: { textColor: s.cor, fontStyle: 'bold' } }, v];
      });
      doc.autoTable({
        startY: y, margin: { left: 15, right: 15 }, theme: 'striped',
        head: [['Componente', 'Frequência', 'Situação', 'Frequência em relação ao mínimo de ' + CONFIG.FREQ_MINIMA + '%']],
        body: linhas.map((l) => l.slice(0, 3).concat([''])),
        headStyles: { fillColor: CINZA, textColor: 255, fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 8.3, cellPadding: 1.7, textColor: TXT },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' }, 1: { cellWidth: 24, halign: 'right' }, 2: { cellWidth: 30 } },
        didDrawCell: (d) => {
          if (d.section !== 'body' || d.column.index !== 3) return;
          const v = linhas[d.row.index][3];
          const x = d.cell.x + 2, yy = d.cell.y + d.cell.height / 2 - 1.3, w = d.cell.width - 4;
          doc.setFillColor(230, 233, 235); doc.rect(x, yy, w, 2.6, 'F');
          if (v != null) { doc.setFillColor(...situacao(v).cor); doc.rect(x, yy, w * Math.min(v, 100) / 100, 2.6, 'F'); }
          doc.setDrawColor(...TXT); doc.setLineWidth(0.25);
          const xm = x + w * CONFIG.FREQ_MINIMA / 100; doc.line(xm, yy - 0.8, xm, yy + 3.4);
        }
      });
      y = doc.lastAutoTable.finalY + 5;
      const fa = f.freqAcumulada;
      y = indicadores(doc, y, [
        { valor: f.totalAulas != null ? f.totalAulas : '—', rotulo: 'Total de aulas (período)' },
        { valor: f.totalFaltas != null ? f.totalFaltas : '—', rotulo: 'Faltas no período' },
        { valor: f.faltasAcumuladas != null ? f.faltasAcumuladas : '—', rotulo: 'Faltas acumuladas' },
        { valor: U.fmtPct(fa), rotulo: 'Frequência acumulada', cor: situacao(fa).cor }
      ]);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.2); doc.setTextColor(...CINZA);
      doc.text(`Fonte: Lista de Frequência da Secretaria Acadêmica, importada em ${U.fmtDataHora(f.importadoEm)}. Frequência mínima exigida: ${CONFIG.FREQ_MINIMA}%. A linha vertical na barra indica o mínimo.`, 15, y, { maxWidth: doc.internal.pageSize.getWidth() - 30 });
      y += 8;
    } else {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...CINZA);
      doc.text('Nenhuma Lista de Frequência importada para este aluno.', 15, y + 2); y += 9;
    }

    // ---------- Portaria
    y = secao(doc, y, '2. Controle de entrada na portaria');
    const pres = hist.presencas;
    const porDia = {}; pres.forEach((p) => { porDia[p.data] = p; });
    const dias = hist.diasLetivos.filter((d) => d <= U.hojeStr());
    const atrasos = pres.filter((p) => p.status === 'Atrasado');
    const ausencias = dias.filter((d) => !porDia[d]);
    const pont = pres.length ? Math.round(((pres.length - atrasos.length) / pres.length) * 1000) / 10 : null;
    y = indicadores(doc, y, [
      { valor: dias.length, rotulo: 'Dias com portaria registrada' },
      { valor: pres.length - atrasos.length, rotulo: 'Entradas no horário', cor: VERDE },
      { valor: atrasos.length, rotulo: `Atrasos (após ${CONFIG.HORARIO_LIMITE})`, cor: atrasos.length ? AMBAR : TXT },
      { valor: ausencias.length, rotulo: 'Sem entrada registrada', cor: ausencias.length ? VERM : TXT },
      { valor: U.fmtPct(pont), rotulo: 'Pontualidade' }
    ]);

    const avisoDe = (tipo, data) => hist.avisos.filter((a) => a.tipo === tipo && a.dataReferencia === data).sort((a, b) => a.enviadoEm < b.enviadoEm ? -1 : 1)[0];
    const ocorr = atrasos.map((p) => ({ data: p.data, tipo: 'Atraso', hora: p.hora.slice(0, 5), aviso: avisoDe('atraso', p.data) }))
      .concat(ausencias.map((d) => ({ data: d, tipo: 'Sem entrada', hora: '—', aviso: avisoDe('falta', d) })))
      .sort((a, b) => (a.data < b.data ? 1 : -1));
    if (ocorr.length) {
      doc.autoTable({
        startY: y, margin: { left: 15, right: 15 }, theme: 'striped',
        head: [['Data', 'Dia', 'Ocorrência', 'Hora', 'Aviso ao responsável']],
        body: ocorr.map((o) => [U.fmtData(o.data), U.diaSemana(o.data), o.tipo, o.hora, o.aviso ? `Enviado ${U.fmtDataHora(o.aviso.enviadoEm)} (${o.aviso.operador})` : 'Não enviado']),
        headStyles: { fillColor: CINZA, textColor: 255, fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 1.5, textColor: TXT },
        columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 20 }, 2: { cellWidth: 26 }, 3: { cellWidth: 14, halign: 'center' } },
        didParseCell: (d) => { if (d.section === 'body' && d.column.index === 2) d.cell.styles.textColor = d.cell.raw === 'Atraso' ? AMBAR : VERM; }
      });
      y = doc.lastAutoTable.finalY + 4;
    } else {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...CINZA);
      doc.text('Nenhuma ocorrência de atraso ou ausência registrada na portaria.', 15, y + 1); y += 6;
    }
    if (hist.fonte === 'aparelho' && !D.DEMO) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(...VERM);
      doc.text('Atenção: gerado sem internet — dados de portaria limitados aos registros salvos neste aparelho.', 15, y + 2); y += 6;
    }

    // ---------- Observações + assinaturas
    y = secao(doc, y + 2, 'Observações');
    y = garantir(doc, y, 22);
    doc.setDrawColor(200, 204, 206); doc.setLineWidth(0.2);
    for (let i = 0; i < 3; i++) doc.line(15, y + 6 + i * 7, doc.internal.pageSize.getWidth() - 15, y + 6 + i * 7);
    y += 26;
    assinaturas(doc, y, ['Coordenação Pedagógica', 'Secretaria Acadêmica', 'Responsável pelo(a) aluno(a)']);
    rodapes(doc);
    salvar(doc, `Frequencia_${aluno.rm}_${U.semAcento(aluno.nome).replace(/\W+/g, '_')}.pdf`);
  };

  // ======================================================================
  // RELATÓRIO DA TURMA
  // ======================================================================
  PDF.turma = async function (chave) {
    const alunos = D.alunosDaTurma(chave);
    if (!alunos.length) { U.toast('Selecione uma turma com alunos.', 'erro'); return; }
    U.toast('Gerando PDF da turma…');
    await carregarLogos();
    const t = await PDF.calcTurma(chave);
    const a0 = alunos[0], ano = t.ano, dias = t.dias;

    const doc = novoDoc();
    let y = cabecalho(doc, 'RELATÓRIO DE FREQUÊNCIA DA TURMA', `${U.rotuloTurma(a0)} · ${a0.habilitacao} · Ano letivo ${ano}`);
    const linhas = t.linhas.map((l, i) => {
      const s = situacao(l.freqAcumulada);
      return [i + 1, l.aluno.rm, l.aluno.nome, U.fmtPct(l.freqAcumulada), l.faltasAcumuladas != null ? l.faltasAcumuladas : '—', l.atrasos, l.semEntrada, { content: s.txt, styles: { textColor: s.cor, fontStyle: 'bold' } }];
    });
    const abaixo = alunos.filter((a) => (D.S.freq[a.rm] || {}).freqAcumulada < CONFIG.FREQ_MINIMA).length;
    const medias = alunos.map((a) => (D.S.freq[a.rm] || {}).freqAcumulada).filter((v) => v != null);
    y = indicadores(doc, y, [
      { valor: alunos.length, rotulo: 'Alunos ativos' },
      { valor: U.fmtPct(medias.length ? medias.reduce((s, v) => s + v, 0) / medias.length : null), rotulo: 'Frequência média' },
      { valor: abaixo, rotulo: `Abaixo de ${CONFIG.FREQ_MINIMA}%`, cor: abaixo ? VERM : TXT },
      { valor: dias.length, rotulo: 'Dias com portaria registrada' }
    ]);
    doc.autoTable({
      startY: y, margin: { left: 15, right: 15 }, theme: 'striped',
      head: [['Nº', 'RM', 'Nome', 'Freq. acum.', 'Faltas acum.', 'Atrasos', 'Sem entrada', 'Situação']],
      body: linhas,
      headStyles: { fillColor: CINZA, textColor: 255, fontSize: 7.5, halign: 'center' },
      styles: { fontSize: 7.6, cellPadding: 1.4, textColor: TXT },
      columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 14 }, 3: { halign: 'right', cellWidth: 18 }, 4: { halign: 'center', cellWidth: 16 }, 5: { halign: 'center', cellWidth: 14 }, 6: { halign: 'center', cellWidth: 17 }, 7: { cellWidth: 22 } }
    });
    y = doc.lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.2); doc.setTextColor(...CINZA);
    doc.text('Frequência e faltas acumuladas: Lista de Frequência da Secretaria Acadêmica. Atrasos e "sem entrada": registros da portaria.', 15, y);
    assinaturas(doc, y + 4, ['Coordenação Pedagógica', 'Direção']);
    rodapes(doc);
    salvar(doc, `Turma_${U.semAcento(U.rotuloTurma(a0)).replace(/\W+/g, '_')}.pdf`);
  };

  // ======================================================================
  // CÁLCULOS COMPARTILHADOS (PDF e Excel)
  // ======================================================================
  PDF.situacao = (v) => situacao(v).txt;

  /** Linha por aluno da turma: frequência da Secretaria + atrasos/ausências da portaria no ano */
  PDF.calcTurma = async function (chave) {
    const alunos = D.alunosDaTurma(chave);
    const ano = new Date().getFullYear();
    const per = await D.presencasPeriodo(`${ano}-01-01`, U.hojeStr());
    const porRm = {};
    per.presencas.forEach((p) => { (porRm[p.rm] = porRm[p.rm] || []).push(p); });
    const linhas = alunos.map((a) => {
      const f = D.S.freq[a.rm] || {};
      const ps = porRm[a.rm] || [];
      const datas = new Set(ps.map((p) => p.data));
      return {
        aluno: a, disciplinas: f.disciplinas || {}, freqAcumulada: f.freqAcumulada, faltasAcumuladas: f.faltasAcumuladas,
        totalAulas: f.totalAulas, totalFaltas: f.totalFaltas,
        entradas: ps.length, atrasos: ps.filter((p) => p.status === 'Atrasado').length,
        semEntrada: per.diasLetivos.filter((d) => !datas.has(d)).length
      };
    });
    return { alunos, linhas, dias: per.diasLetivos, ano, fonte: per.fonte };
  };

  /** Movimento de um dia: por turma + listas de atrasados e ausentes */
  PDF.calcDia = function (data, chaveTurma) {
    const pres = D.presencasDoDia(data);
    const porRm = {}; pres.forEach((p) => { porRm[p.rm] = p; });
    const turmas = D.turmas().filter(([k]) => !chaveTurma || k === chaveTurma);
    const porTurma = turmas.map(([k, rotulo]) => {
      const al = D.alunosDaTurma(k);
      const presentes = al.filter((a) => porRm[a.rm]);
      const atrasados = presentes.filter((a) => porRm[a.rm].status === 'Atrasado');
      return { chave: k, rotulo, matriculados: al.length, presentes: presentes.length, noHorario: presentes.length - atrasados.length, atrasados: atrasados.length, ausentes: al.length - presentes.length };
    });
    const todos = turmas.flatMap(([k]) => D.alunosDaTurma(k));
    const aviso = (rm, tipo) => D.avisoEnviado(rm, tipo, data);
    const atrasados = todos.filter((a) => porRm[a.rm] && porRm[a.rm].status === 'Atrasado')
      .map((a) => ({ aluno: a, hora: porRm[a.rm].hora, operador: porRm[a.rm].operador, aviso: aviso(a.rm, 'atraso') }))
      .sort((x, y) => (x.hora < y.hora ? -1 : 1));
    const ausentes = todos.filter((a) => !porRm[a.rm]).map((a) => ({ aluno: a, aviso: aviso(a.rm, 'falta') }));
    const noHorario = todos.filter((a) => porRm[a.rm] && porRm[a.rm].status !== 'Atrasado').map((a) => ({ aluno: a, hora: porRm[a.rm].hora }));
    const soma = (k) => porTurma.reduce((s, t) => s + t[k], 0);
    return { data, porTurma, atrasados, ausentes, noHorario, total: { matriculados: soma('matriculados'), presentes: soma('presentes'), noHorario: soma('noHorario'), atrasados: soma('atrasados'), ausentes: soma('ausentes') } };
  };

  // ======================================================================
  // RELATÓRIO DIÁRIO DA PORTARIA
  // ======================================================================
  PDF.dia = async function (data, chaveTurma) {
    const r = PDF.calcDia(data, chaveTurma);
    if (!r.total.matriculados) { U.toast('Nenhum aluno cadastrado para este relatório.', 'erro'); return; }
    U.toast('Gerando relatório do dia…');
    await carregarLogos();
    const doc = novoDoc();
    const filtro = chaveTurma ? (D.turmas().find(([k]) => k === chaveTurma) || [])[1] : 'Todas as turmas';
    let y = cabecalho(doc, 'RELATÓRIO DIÁRIO DA PORTARIA', `${U.diaSemana(data)}, ${U.fmtData(data)} · ${filtro} · Portão fecha às ${CONFIG.HORARIO_LIMITE}`);
    const t = r.total;
    const pct = (n) => (t.matriculados ? U.fmtPct(Math.round((n / t.matriculados) * 1000) / 10) : '—');
    const avisados = r.atrasados.filter((x) => x.aviso).length + r.ausentes.filter((x) => x.aviso).length;
    y = indicadores(doc, y, [
      { valor: t.matriculados, rotulo: 'Alunos ativos' },
      { valor: `${t.presentes} (${pct(t.presentes)})`, rotulo: 'Entraram' },
      { valor: t.noHorario, rotulo: 'No horário', cor: VERDE },
      { valor: t.atrasados, rotulo: `Atrasados (após ${CONFIG.HORARIO_LIMITE})`, cor: t.atrasados ? AMBAR : TXT },
      { valor: t.ausentes, rotulo: 'Sem entrada', cor: t.ausentes ? VERM : TXT },
      { valor: avisados, rotulo: 'Responsáveis avisados' }
    ]);

    y = secao(doc, y, '1. Resumo por turma');
    doc.autoTable({
      startY: y, margin: { left: 15, right: 15 }, theme: 'striped',
      head: [['Turma', 'Ativos', 'Entraram', 'No horário', 'Atrasados', 'Sem entrada', '% presença']],
      body: r.porTurma.map((x) => [x.rotulo, x.matriculados, x.presentes, x.noHorario, x.atrasados, x.ausentes, x.matriculados ? U.fmtPct(Math.round((x.presentes / x.matriculados) * 1000) / 10) : '—'])
        .concat([[{ content: 'TOTAL', styles: { fontStyle: 'bold' } }, t.matriculados, t.presentes, t.noHorario, t.atrasados, t.ausentes, pct(t.presentes)]]),
      headStyles: { fillColor: CINZA, textColor: 255, fontSize: 8 },
      styles: { fontSize: 8.2, cellPadding: 1.6, textColor: TXT, halign: 'center' },
      columnStyles: { 0: { halign: 'left', cellWidth: 62 } },
      didParseCell: (d) => { if (d.section === 'body' && d.row.index === r.porTurma.length) { d.cell.styles.fillColor = CLARO; d.cell.styles.fontStyle = 'bold'; } }
    });
    y = doc.lastAutoTable.finalY + 6;

    const txtAviso = (a) => (a ? `Enviado ${a.enviadoEm.slice(11, 16)} (${a.operador})` : 'Não enviado');
    y = secao(doc, y, `2. Atrasados (${r.atrasados.length})`);
    if (r.atrasados.length) {
      doc.autoTable({
        startY: y, margin: { left: 15, right: 15 }, theme: 'striped',
        head: [['Hora', 'RM', 'Nome', 'Turma', 'Aviso ao responsável']],
        body: r.atrasados.map((x) => [x.hora.slice(0, 5), x.aluno.rm, x.aluno.nome, U.rotuloTurma(x.aluno), txtAviso(x.aviso)]),
        headStyles: { fillColor: AMBAR, textColor: 255, fontSize: 8 },
        styles: { fontSize: 7.8, cellPadding: 1.4, textColor: TXT },
        columnStyles: { 0: { cellWidth: 13, halign: 'center', fontStyle: 'bold' }, 1: { cellWidth: 14 }, 3: { cellWidth: 42 }, 4: { cellWidth: 36 } }
      });
      y = doc.lastAutoTable.finalY + 6;
    } else { doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...CINZA); doc.text('Nenhum atraso.', 15, y + 1); y += 7; }

    y = secao(doc, y, `3. Sem entrada registrada (${r.ausentes.length})`);
    if (r.ausentes.length) {
      doc.autoTable({
        startY: y, margin: { left: 15, right: 15 }, theme: 'striped',
        head: [['RM', 'Nome', 'Turma', 'Aviso ao responsável']],
        body: r.ausentes.map((x) => [x.aluno.rm, x.aluno.nome, U.rotuloTurma(x.aluno), txtAviso(x.aviso)]),
        headStyles: { fillColor: VERM, textColor: 255, fontSize: 8 },
        styles: { fontSize: 7.8, cellPadding: 1.4, textColor: TXT },
        columnStyles: { 0: { cellWidth: 14 }, 2: { cellWidth: 42 }, 3: { cellWidth: 36 } }
      });
      y = doc.lastAutoTable.finalY + 4;
    } else { doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...CINZA); doc.text('Todos os alunos ativos entraram.', 15, y + 1); y += 6; }
    if (data === U.hojeStr() && U.horaStr().slice(0, 5) <= CONFIG.HORARIO_LIMITE) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.2); doc.setTextColor(...VERM);
      doc.text(`Atenção: relatório emitido às ${U.horaStr().slice(0, 5)}, antes do fechamento do portão — os números ainda podem mudar.`, 15, y + 2); y += 6;
    }
    assinaturas(doc, y + 2, ['Inspetor(a) responsável', 'Coordenação']);
    rodapes(doc);
    salvar(doc, `Portaria_${data}${chaveTurma ? '_' + U.semAcento(filtro).replace(/\W+/g, '_') : ''}.pdf`);
  };

  PDF.mostrar = salvar; // pré-visualização + baixar/compartilhar, usada por outros módulos
  window.PDF = PDF;
})();
