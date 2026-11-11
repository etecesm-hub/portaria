/* QR Code próprio do aluno (conteúdo fixo "RM:<número>")
   - Etiquetas A4 por turma (PDF, 21 por folha — formato Pimaco A4256 / 63,5 x 38,1 mm)
   - Imagem individual (PNG) para o aluno guardar no celular ou receber pelo WhatsApp */
(function () {
  const Q = {};
  const VERM = [178, 20, 15], CINZA = [69, 85, 92], TXT = [33, 37, 41];

  Q.conteudo = (rm) => `RM:${rm}`;

  /** Matriz do QR (biblioteca qrcode-generator). Nível M: aguenta riscos e reflexo. */
  function matriz(texto) {
    if (!window.qrcode) throw new Error('Gerador de QR não carregou. Abra o app com internet uma vez.');
    const q = qrcode(0, 'M');
    q.addData(texto);
    q.make();
    const n = q.getModuleCount();
    return { n, escuro: (l, c) => q.isDark(l, c) };
  }

  /** Desenha o QR em vetor no PDF (nítido em qualquer impressora). */
  function qrNoPdf(doc, texto, x, y, tam) {
    const m = matriz(texto);
    const quiet = 2;                                   // margem branca em módulos
    const cel = tam / (m.n + quiet * 2);
    doc.setFillColor(255, 255, 255); doc.rect(x, y, tam, tam, 'F');
    doc.setFillColor(0, 0, 0);
    for (let l = 0; l < m.n; l++) {
      let c = 0;
      while (c < m.n) {                                // junta módulos vizinhos numa barra só
        if (!m.escuro(l, c)) { c++; continue; }
        let f = c; while (f + 1 < m.n && m.escuro(l, f + 1)) f++;
        doc.rect(x + (c + quiet) * cel, y + (l + quiet) * cel, (f - c + 1) * cel + 0.01, cel + 0.01, 'F');
        c = f + 1;
      }
    }
  }

  /** Desenha o QR num canvas. */
  function qrNoCanvas(ctx, texto, x, y, tam) {
    const m = matriz(texto);
    const quiet = 2, cel = tam / (m.n + quiet * 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y, tam, tam);
    ctx.fillStyle = '#000';
    for (let l = 0; l < m.n; l++) for (let c = 0; c < m.n; c++) {
      if (m.escuro(l, c)) ctx.fillRect(Math.floor(x + (c + quiet) * cel), Math.floor(y + (l + quiet) * cel), Math.ceil(cel), Math.ceil(cel));
    }
  }

  function quebrar(doc, texto, larg, maxLinhas) {
    let linhas = doc.splitTextToSize(texto, larg);
    if (linhas.length > maxLinhas) {
      linhas = linhas.slice(0, maxLinhas);
      linhas[maxLinhas - 1] = linhas[maxLinhas - 1].replace(/\s*\S*$/, '') + '…';
    }
    return linhas;
  }

  // ======================================================================
  // ETIQUETAS A4 POR TURMA
  // ======================================================================
  Q.etiquetas = function (chaveTurma) {
    const alunos = chaveTurma
      ? D.alunosDaTurma(chaveTurma)
      : Object.values(D.S.alunos).filter((a) => a.ativo)
        .sort((a, b) => U.rotuloTurma(a).localeCompare(U.rotuloTurma(b), 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
    if (!alunos.length) { U.toast('Nenhum aluno para gerar etiquetas.', 'erro'); return; }
    U.toast(`Gerando ${alunos.length} etiqueta(s)…`);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    // Pimaco A4256 (e equivalentes): 3 colunas x 7 linhas, 63,5 x 38,1 mm
    const COLS = 3, LINS = 7, LW = 63.5, LH = 38.1, MX = 7.2, MY = 15.15, GX = 2.5, GY = 0;
    const porFolha = COLS * LINS;

    alunos.forEach((a, i) => {
      if (i && i % porFolha === 0) doc.addPage();
      const pos = i % porFolha, col = pos % COLS, lin = Math.floor(pos / COLS);
      const x = MX + col * (LW + GX), y = MY + lin * (LH + GY);

      // contorno leve (guia de corte para papel comum; quase invisível na etiqueta adesiva)
      doc.setDrawColor(215, 219, 222); doc.setLineWidth(0.15);
      doc.roundedRect(x + 0.6, y + 0.6, LW - 1.2, LH - 1.2, 2, 2, 'S');
      // faixa vermelha
      doc.setFillColor(...VERM); doc.rect(x + 0.6, y + 3, 1.4, LH - 6, 'F');

      const tq = 31;                                   // QR de 31 mm
      qrNoPdf(doc, Q.conteudo(a.rm), x + 3.2, y + (LH - tq) / 2, tq);

      const tx = x + 3.2 + tq + 1.5, tl = LW - (tx - x) - 2.2;
      doc.setTextColor(...CINZA); doc.setFont('helvetica', 'bold'); doc.setFontSize(5.4);
      doc.text('ETEC ZL · CEU SÃO MIGUEL', tx, y + 6);
      doc.setTextColor(...TXT); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2);
      const nome = quebrar(doc, U.nomeProprio(a.nome), tl, 3);
      doc.text(nome, tx, y + 10.2, { lineHeightFactor: 1.15 });
      const yRm = y + 10.2 + nome.length * 3 + 2.8;
      doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(...CINZA);
      doc.text('RM', tx, yRm);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...VERM);
      doc.text(a.rm, tx, yRm + 5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.6); doc.setTextColor(...CINZA);
      doc.text(quebrar(doc, U.rotuloTurma(a), tl, 2), tx, yRm + 9);
    });

    const nomeTurma = chaveTurma ? U.semAcento((D.turmas().find(([k]) => k === chaveTurma) || [])[1] || '').replace(/\W+/g, '_') : 'Todas_as_turmas';
    PDF.mostrar(doc, `Etiquetas_QR_${nomeTurma}.pdf`);
  };

  // ======================================================================
  // IMAGEM INDIVIDUAL (PNG)
  // ======================================================================
  let logo = null;
  function carregarLogo() {
    if (logo) return Promise.resolve(logo);
    return new Promise((ok) => {
      const im = new Image();
      im.onload = () => { logo = im; ok(im); };
      im.onerror = () => ok(null);
      im.src = 'icons/logo-etec.png';
    });
  }

  function linhasCanvas(ctx, texto, larg, max) {
    const palavras = texto.split(' '), linhas = [];
    let atual = '';
    palavras.forEach((p) => {
      const t = atual ? atual + ' ' + p : p;
      if (ctx.measureText(t).width > larg && atual) { linhas.push(atual); atual = p; } else atual = t;
    });
    if (atual) linhas.push(atual);
    return linhas.slice(0, max);
  }

  Q.imagem = async function (aluno) {
    const W = 1080, H = 1500;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#f3f4f5'; ctx.fillRect(0, 0, W, H);
    // cartão
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(60, 60, W - 120, H - 120, 40) : ctx.rect(60, 60, W - 120, H - 120); ctx.fill();
    // topo vermelho
    ctx.fillStyle = '#b2140f';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(60, 60, W - 120, 200, [40, 40, 0, 0]) : ctx.rect(60, 60, W - 120, 200); ctx.fill();
    const lg = await carregarLogo();
    if (lg) {
      const h = 120, w = h * lg.width / lg.height;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(100, 100, w + 40, h + 0, 18) : ctx.rect(100, 100, w + 40, h); ctx.fill();
      ctx.drawImage(lg, 120, 100, w, h);
    }
    ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
    ctx.font = 'bold 44px system-ui, Arial'; ctx.fillText('QR da Portaria', W - 110, 155);
    ctx.font = '30px system-ui, Arial'; ctx.fillText('Extensão CEU São Miguel', W - 110, 200);
    // QR
    const tq = 680;
    qrNoCanvas(ctx, Q.conteudo(aluno.rm), (W - tq) / 2, 310, tq);
    // textos
    ctx.textAlign = 'center'; ctx.fillStyle = '#1f2528';
    ctx.font = 'bold 54px system-ui, Arial';
    const ls = linhasCanvas(ctx, U.nomeProprio(aluno.nome), W - 220, 2);
    ls.forEach((l, i) => ctx.fillText(l, W / 2, 1075 + i * 64));
    const yb = 1075 + ls.length * 64 + 30;
    ctx.fillStyle = '#b2140f'; ctx.font = 'bold 76px system-ui, Arial'; ctx.fillText(`RM ${aluno.rm}`, W / 2, yb + 40);
    ctx.fillStyle = '#66737a'; ctx.font = '36px system-ui, Arial'; ctx.fillText(U.rotuloTurma(aluno), W / 2, yb + 100);
    ctx.font = '28px system-ui, Arial'; ctx.fillText('Apresente este QR na portaria · Etec da Zona Leste', W / 2, H - 100);
    return new Promise((ok) => cv.toBlob((b) => ok({ blob: b, url: cv.toDataURL('image/png') }), 'image/png'));
  };

  /** Painel com a imagem do QR do aluno + baixar / compartilhar */
  Q.abrirAluno = async function (rm) {
    const a = D.S.alunos[rm]; if (!a) return;
    let img;
    try { img = await Q.imagem(a); } catch (e) { U.toast(e.message, 'erro'); return; }
    const nome = `QR_${a.rm}_${U.semAcento(a.nome).replace(/\W+/g, '_')}.png`;
    const arquivo = new File([img.blob], nome, { type: 'image/png' });
    const podeCompartilhar = !!(navigator.canShare && navigator.canShare({ files: [arquivo] }));
    App.abrirPainel(`
      <h2>QR do aluno</h2>
      <p class="dica">${U.esc(U.nomeProprio(a.nome))} · RM ${a.rm}. Este QR é fixo: vale para o ano todo e funciona sem internet.</p>
      <img src="${img.url}" alt="QR Code do RM ${a.rm}" class="qr-imagem">
      <div class="acoes-ficha">
        ${podeCompartilhar ? '<button class="btn btn-whats" id="qr-compartilhar">↗ Compartilhar (WhatsApp…)</button>' : ''}
        <button class="btn btn-primario" id="qr-baixar">⬇ Baixar imagem</button>
      </div>
      <p class="dica">Dica: o aluno pode salvar a imagem na galeria e mostrar na portaria, ou você imprime as etiquetas da turma na aba Alunos.</p>`);
    U.$('#qr-baixar').onclick = () => PDF.baixar(img.blob, nome);
    const bc = U.$('#qr-compartilhar');
    if (bc) bc.onclick = () => navigator.share({ files: [arquivo], title: `QR da portaria – RM ${a.rm}`, text: `QR da portaria de ${U.nomeProprio(a.nome)} (RM ${a.rm}). Apresente na entrada da escola.` }).catch(() => {});
  };

  window.QR = Q;
})();
