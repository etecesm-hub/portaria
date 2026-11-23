/* Fotos 3x4 dos alunos
   - Fonte: aba "Fotos" da planilha (só com login; nunca no site público).
   - Cópia no aparelho (IndexedDB) para aparecer na portaria mesmo sem internet.
   - Cada foto é reduzida no próprio celular para 240 x 320 px (~15 KB). */
(function () {
  const F = {};
  const BANCO = 'cp_fotos', LOJA = 'fotos', CHAVE_VERSAO = 'cp_versaoFotos';
  const memoria = {};          // rm -> dataURL (para desenhar na hora, sem esperar o banco)
  let dbPromessa = null;

  function abrir() {
    if (dbPromessa) return dbPromessa;
    dbPromessa = new Promise((ok, erro) => {
      if (!window.indexedDB) { erro(new Error('Sem IndexedDB')); return; }
      const r = indexedDB.open(BANCO, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(LOJA);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => erro(r.error);
    });
    return dbPromessa;
  }
  async function transacao(modo, fn) {
    const db = await abrir();
    return new Promise((ok, erro) => {
      const tx = db.transaction(LOJA, modo);
      const res = fn(tx.objectStore(LOJA));
      tx.oncomplete = () => ok(res && res.result !== undefined ? res.result : res);
      tx.onerror = () => erro(tx.error);
    });
  }

  F.url = (rm) => memoria[rm] || '';
  F.tem = (rm) => !!memoria[rm];
  F.total = () => Object.keys(memoria).length;

  /** HTML de uma foto (ou das iniciais, se não houver foto) */
  F.html = function (aluno, classe) {
    const rm = aluno && aluno.rm;
    const u = rm && memoria[rm];
    if (u) return `<img class="foto ${classe || ''}" src="${u}" alt="Foto de ${U.esc(U.nomeProprio(aluno.nome))}">`;
    const ini = String((aluno && aluno.nome) || '?').split(/\s+/).filter(Boolean);
    const txt = ((ini[0] || '?')[0] + (ini.length > 1 ? ini[ini.length - 1][0] : '')).toUpperCase();
    return `<span class="foto foto-vazia ${classe || ''}" aria-hidden="true">${U.esc(txt)}</span>`;
  };

  /** Carrega para a memória as fotos guardadas no aparelho */
  F.carregarLocal = async function () {
    try {
      const db = await abrir();
      await new Promise((ok, erro) => {
        const tx = db.transaction(LOJA, 'readonly');
        const cur = tx.objectStore(LOJA).openCursor();
        cur.onsuccess = () => { const c = cur.result; if (c) { memoria[c.key] = c.value; c.continue(); } };
        tx.oncomplete = ok; tx.onerror = () => erro(tx.error);
      });
    } catch (e) { console.warn('fotos locais', e); }
    return F.total();
  };

  async function guardarLocal(mapa) {
    Object.assign(memoria, mapa);
    try { await transacao('readwrite', (loja) => { Object.entries(mapa).forEach(([rm, u]) => loja.put(u, rm)); }); }
    catch (e) { console.warn('não guardou fotos no aparelho', e); }
  }

  /** Baixa da planilha só as fotos novas (chamado quando o servidor avisa versão diferente) */
  let baixando = false;
  F.sincronizar = async function (versaoServidor) {
    if (D.DEMO || !D.logado() || baixando || !navigator.onLine) return;
    const local = localStorage.getItem(CHAVE_VERSAO) || '';
    if (versaoServidor !== undefined && versaoServidor === local) return;
    baixando = true;
    try {
      const r = await D.api('fotos', { desde: F.total() ? local : '' });
      const n = Object.keys(r.fotos || {}).length;
      if (n) await guardarLocal(r.fotos);
      try { localStorage.setItem(CHAVE_VERSAO, r.versao || ''); } catch (e) { /* ok */ }
      if (n) D.avisar('fotos');
    } catch (e) { console.warn('sync fotos', e); }
    finally { baixando = false; }
  };

  /** Reduz qualquer imagem para JPEG 240x320 (3x4), recortando o centro */
  F.reduzir = function (arquivoOuBlob) {
    return new Promise((ok, erro) => {
      const url = URL.createObjectURL(arquivoOuBlob);
      const im = new Image();
      im.onload = () => {
        const W = 240, H = 320, alvo = W / H;
        let sw = im.naturalWidth, sh = im.naturalHeight, sx = 0, sy = 0;
        if (sw / sh > alvo) { const nw = sh * alvo; sx = (sw - nw) / 2; sw = nw; }
        else { const nh = sw / alvo; sy = Math.max(0, (sh - nh) * 0.35); sh = nh; } // corta mais embaixo (rosto fica)
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
        g.drawImage(im, sx, sy, sw, sh, 0, 0, W, H);
        URL.revokeObjectURL(url);
        let q = 0.82, d = cv.toDataURL('image/jpeg', q);
        while (d.length > 40000 && q > 0.4) { q -= 0.08; d = cv.toDataURL('image/jpeg', q); }
        ok(d);
      };
      im.onerror = () => { URL.revokeObjectURL(url); erro(new Error('Arquivo não é uma imagem válida')); };
      im.src = url;
    });
  };

  /** Envia fotos para a planilha em lotes e guarda no aparelho. lista: [{rm, foto}] */
  F.salvar = async function (lista, aoProgresso) {
    if (D.DEMO) { const m = {}; lista.forEach((f) => { m[f.rm] = f.foto; }); await guardarLocal(m); D.avisar('fotos'); return lista.length; }
    if (!navigator.onLine) throw new Error('Para gravar fotos é preciso internet.');
    let feitas = 0, versao = '';
    for (let i = 0; i < lista.length; i += 15) {
      const lote = lista.slice(i, i + 15);
      const r = await D.api('salvarFotos', { fotos: lote });
      versao = r.versao;
      const m = {}; lote.forEach((f) => { m[f.rm] = f.foto; }); await guardarLocal(m);
      feitas += lote.length;
      if (aoProgresso) aoProgresso(feitas, lista.length);
    }
    try { localStorage.setItem(CHAVE_VERSAO, versao); } catch (e) { /* ok */ }
    D.avisar('fotos');
    return feitas;
  };

  // ------------------------------------------------------------------ Importação em lote (aba Importar)
  /** Arquivos nomeados pelo RM (27247.jpg). Mostra prévia e grava após confirmar. */
  F.importarArquivos = async function (arquivos) {
    const box = U.$('#preview-fotos');
    box.hidden = false;
    box.innerHTML = '<div class="cartao"><p class="dica">Lendo fotos…</p></div>';
    const ok = [], semAluno = [], invalidas = [];
    for (const arq of arquivos) {
      const rm = U.normalizarRM(arq.name.replace(/\.[a-z0-9]+$/i, ''));
      const aluno = rm && D.S.alunos[rm];
      if (!aluno) { semAluno.push(arq.name); continue; }
      try { ok.push({ rm, foto: await F.reduzir(arq), aluno }); }
      catch (e) { invalidas.push(arq.name); }
    }
    ok.sort((a, b) => U.rotuloTurma(a.aluno).localeCompare(U.rotuloTurma(b.aluno), 'pt-BR') || a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR'));
    const substitui = ok.filter((f) => F.tem(f.rm)).length;
    box.innerHTML = `
      <div class="cartao">
        <div class="tag">Fotos dos alunos</div>
        <p><b>${ok.length}</b> foto(s) reconhecida(s) pelo RM${substitui ? ` · ${substitui} vão substituir fotos atuais` : ''}.</p>
        ${semAluno.length ? `<p class="alerta">⚠ ${semAluno.length} arquivo(s) sem aluno com esse RM: ${semAluno.slice(0, 8).map(U.esc).join(', ')}${semAluno.length > 8 ? '…' : ''}</p>` : ''}
        ${invalidas.length ? `<p class="alerta">⚠ Não são imagens: ${invalidas.map(U.esc).join(', ')}</p>` : ''}
        <p class="dica">Confira se cada foto é do aluno certo antes de gravar.</p>
        <div class="grade-fotos">${ok.map((f) => `<figure><img src="${f.foto}" alt=""><figcaption><b>${f.rm}</b> ${U.esc(U.nomeProprio(f.aluno.nome))}</figcaption></figure>`).join('')}</div>
        <button class="btn btn-primario btn-grande btn-bloco" id="fotos-confirmar" ${ok.length ? '' : 'disabled'}>Gravar ${ok.length} foto(s)</button>
        <button class="btn btn-sec btn-bloco" id="fotos-cancelar">Cancelar</button>
      </div>`;
    U.$('#fotos-cancelar').onclick = () => { box.hidden = true; U.$('#arquivo-fotos').value = ''; };
    U.$('#fotos-confirmar').onclick = async (ev) => {
      const btn = ev.currentTarget; btn.disabled = true;
      try {
        const n = await F.salvar(ok.map(({ rm, foto }) => ({ rm, foto })), (f, t) => { btn.textContent = `Gravando… ${f}/${t}`; });
        box.innerHTML = `<div class="cartao sucesso">✅ ${n} foto(s) gravada(s) na planilha.<br><small>Os outros celulares recebem na próxima sincronização.</small></div>`;
        U.$('#arquivo-fotos').value = '';
      } catch (e) { btn.disabled = false; btn.textContent = 'Tentar de novo'; U.toast('Erro: ' + e.message, 'erro'); }
    };
  };

  /** Trocar a foto de um aluno (câmera ou galeria do celular) */
  F.trocar = function (rm, aoTerminar) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const arq = inp.files[0]; if (!arq) return;
      try {
        const foto = await F.reduzir(arq);
        await F.salvar([{ rm, foto }]);
        U.toast('Foto atualizada ✔');
        if (aoTerminar) aoTerminar();
      } catch (e) { U.toast('Erro: ' + e.message, 'erro'); }
    };
    inp.click();
  };

  window.Fotos = F;
})();
