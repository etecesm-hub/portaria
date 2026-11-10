/* Importação inteligente de planilhas da Secretaria (.xlsx / .xls / .csv)
   Detecta automaticamente: Relação de Alunos | Lista de Frequência | Contatos */
(function () {
  const I = {};

  const COLS_FIXAS = ['RM', 'NOME', 'GRUPO', 'T. AULAS', 'T AULAS', 'T. FALTAS', 'T FALTAS', 'FALTAS ACUM.', 'FALTAS ACUM',
    'FREQ % ACUM.', 'FREQ % ACUM', 'FREQ. % ACUM.', 'SERIE', 'MODULO', 'TURMA', 'HABILITACAO', 'CURSO', 'ANO'];
  const ALIAS = {
    telefone: ['TELEFONE', 'TELEFONE RESPONSAVEL', 'TEL RESPONSAVEL', 'TEL. RESPONSAVEL', 'CELULAR', 'CELULAR RESPONSAVEL', 'WHATSAPP', 'FONE', 'TELEFONE DO RESPONSAVEL'],
    responsavel: ['RESPONSAVEL', 'NOME RESPONSAVEL', 'NOME DO RESPONSAVEL', 'RESPONSAVEL LEGAL', 'MAE', 'PAI'],
    totalAulas: ['T. AULAS', 'T AULAS', 'TOTAL AULAS', 'TOTAL DE AULAS'],
    totalFaltas: ['T. FALTAS', 'T FALTAS', 'TOTAL FALTAS', 'TOTAL DE FALTAS'],
    faltasAcum: ['FALTAS ACUM.', 'FALTAS ACUM', 'FALTAS ACUMULADAS'],
    freqAcum: ['FREQ % ACUM.', 'FREQ % ACUM', 'FREQ. % ACUM.', 'FREQ.% ACUM.', 'FREQUENCIA ACUMULADA', '% FREQ ACUM'],
    serie: ['SERIE', 'MODULO', 'MODULO/SERIE'], turma: ['TURMA'], habilitacao: ['HABILITACAO', 'CURSO'], grupo: ['GRUPO']
  };

  function achar(cab, chave) {
    const lista = ALIAS[chave];
    return cab.findIndex((c) => lista.includes(c));
  }

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace('%', '').replace(',', '.').trim());
    return isNaN(n) ? null : Math.round(n * 10) / 10;
  }

  /** Lê o arquivo e devolve a estrutura detectada */
  I.ler = async function (arquivo) {
    const buf = await arquivo.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', codepage: 65001 });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
    return I.interpretar(linhas, arquivo.name);
  };

  I.interpretar = function (linhas, nomeArquivo) {
    const iCab = linhas.findIndex((r) => r && r.some((c) => U.norm(c) === 'RM'));
    if (iCab < 0) throw new Error('Não encontrei a coluna "RM" na planilha.');
    const cab = linhas[iCab].map((c) => U.norm(c));
    const meta = extrairMeta(linhas.slice(0, iCab).flat().filter(Boolean).join(' '));
    const iRM = cab.indexOf('RM');
    const iNome = cab.indexOf('NOME');
    const idx = {};
    Object.keys(ALIAS).forEach((k) => { idx[k] = achar(cab, k); });

    const ehFreq = idx.freqAcum >= 0 || idx.totalAulas >= 0;
    const ehContatos = !ehFreq && idx.telefone >= 0 && (iNome < 0 || idx.grupo < 0);
    const tipo = ehFreq ? 'frequencia' : ehContatos ? 'contatos' : 'alunos';
    if (tipo === 'alunos' && iNome < 0) throw new Error('A planilha de alunos precisa da coluna "NOME".');

    // Colunas de disciplinas = entre NOME e T. AULAS que não sejam colunas conhecidas
    let discCols = [];
    if (ehFreq) {
      const fim = idx.totalAulas >= 0 ? idx.totalAulas : cab.length;
      for (let c = Math.max(iRM, iNome) + 1; c < fim; c++) {
        if (cab[c] && !COLS_FIXAS.includes(cab[c])) discCols.push({ c, sigla: String(linhas[iCab][c]).trim() });
      }
    }

    const dados = linhas.slice(iCab + 1).filter((r) => r && U.normalizarRM(r[iRM]));
    const alertas = [];
    const vistos = new Set();
    const registros = [];
    dados.forEach((r) => {
      const rm = U.normalizarRM(r[iRM]);
      if (vistos.has(rm)) { alertas.push(`RM ${rm} repetido na planilha (mantida a 1ª linha).`); return; }
      vistos.add(rm);
      const base = {
        rm,
        nome: iNome >= 0 ? String(r[iNome] || '').trim().toUpperCase() : '',
        serie: idx.serie >= 0 && r[idx.serie] ? String(r[idx.serie]).replace(/\D/g, '') : meta.serie,
        turma: idx.turma >= 0 && r[idx.turma] ? String(r[idx.turma]).trim().toUpperCase() : meta.turma,
        habilitacao: idx.habilitacao >= 0 && r[idx.habilitacao] ? String(r[idx.habilitacao]).trim().toUpperCase() : meta.habilitacao,
        ano: meta.ano
      };
      if (tipo === 'alunos') {
        registros.push(Object.assign(base, {
          grupo: idx.grupo >= 0 ? String(r[idx.grupo] || '').trim() : '',
          telefone: idx.telefone >= 0 ? String(r[idx.telefone] || '').trim() : '',
          nomeResponsavel: idx.responsavel >= 0 ? String(r[idx.responsavel] || '').trim() : ''
        }));
      } else if (tipo === 'contatos') {
        registros.push({ rm, telefone: String(r[idx.telefone] || '').trim(), nomeResponsavel: idx.responsavel >= 0 ? String(r[idx.responsavel] || '').trim() : '' });
      } else {
        const disciplinas = {};
        discCols.forEach((d) => { disciplinas[d.sigla] = num(r[d.c]); });
        registros.push(Object.assign(base, {
          disciplinas,
          totalAulas: idx.totalAulas >= 0 ? num(r[idx.totalAulas]) : null,
          totalFaltas: idx.totalFaltas >= 0 ? num(r[idx.totalFaltas]) : null,
          faltasAcumuladas: idx.faltasAcum >= 0 ? num(r[idx.faltasAcum]) : null,
          freqAcumulada: idx.freqAcum >= 0 ? num(r[idx.freqAcum]) : null
        }));
      }
    });

    // Componente com 0% para TODOS os alunos = ainda sem aulas lançadas (não é falta)
    if (tipo === 'frequencia' && registros.length > 2) {
      discCols.forEach((d) => {
        if (registros.every((x) => x.disciplinas[d.sigla] === 0 || x.disciplinas[d.sigla] == null)) {
          registros.forEach((x) => { x.disciplinas[d.sigla] = null; });
          alertas.push(`${d.sigla}: 0% para todos — tratado como "sem aulas lançadas".`);
        }
      });
    }

    if (tipo !== 'contatos' && (!meta.serie || !meta.turma)) alertas.push('Série/Turma não encontradas no cabeçalho: confira os campos abaixo.');
    // A Secretaria às vezes exporta com o ano de ingresso (ex.: 2º ano saindo com "Ano: 2025")
    const anoAtual = String(new Date().getFullYear());
    if (tipo !== 'contatos' && meta.ano !== anoAtual) {
      if (meta.ano) alertas.push(`O cabeçalho indica "Ano: ${meta.ano}". Ajustado para o ano letivo atual (${anoAtual}) — altere abaixo se necessário.`);
      meta.anoPlanilha = meta.ano;
      meta.ano = anoAtual;
      registros.forEach((r) => { r.ano = anoAtual; });
    }
    return { tipo, meta, registros, alertas, disciplinas: discCols.map((d) => d.sigla), arquivo: nomeArquivo };
  };

  function extrairMeta(txt) {
    const t = U.semAcento(txt).replace(/\s+/g, ' ');
    const pega = (re) => { const m = t.match(re); return m ? m[1].trim() : ''; };
    // o texto original (com acentos) para habilitação
    const orig = String(txt).replace(/\s+/g, ' ');
    const mh = orig.match(/Habilita\S*:\s*(.*?)\s+Turma:/i);
    return {
      habilitacao: (mh ? mh[1] : pega(/Habilitacao:\s*(.*?)\s+Turma:/i)).trim().toUpperCase(),
      turma: pega(/Turma:\s*(.*?)\s+(Semestre|Ano|Modulo)/i).toUpperCase(),
      ano: pega(/Ano:\s*(\d{4})/i),
      serie: pega(/Serie:\s*(\d+)/i) || pega(/Modulo\S*:\s*(\d+)/i)
    };
  }

  // ------------------------------------------------------------------ Interface
  I.mostrarPreview = function (res) {
    const box = U.$('#preview');
    const nomes = { alunos: 'Relação de Alunos', frequencia: 'Lista de Frequência por componente', contatos: 'Contatos dos responsáveis' };
    const amostra = res.registros.slice(0, 5);
    const novos = res.registros.filter((r) => !D.S.alunos[r.rm]).length;
    const transf = res.tipo === 'alunos' ? res.registros.filter((r) => D.S.alunos[r.rm] && U.chaveTurma(D.S.alunos[r.rm]) !== U.chaveTurma(r)).length : 0;
    const semCadastro = res.tipo !== 'alunos' ? res.registros.filter((r) => !D.S.alunos[r.rm]).length : 0;

    box.hidden = false;
    box.innerHTML = `
      <div class="cartao">
        <div class="tag">${nomes[res.tipo]}</div>
        <p><b>${res.registros.length}</b> aluno(s) em <i>${U.esc(res.arquivo)}</i></p>
        ${res.tipo !== 'contatos' ? `
        <div class="grade-campos">
          <label>Série <input id="imp-serie" value="${U.esc(res.meta.serie)}" inputmode="numeric"></label>
          <label>Turma <input id="imp-turma" value="${U.esc(res.meta.turma)}"></label>
          <label class="larga">Habilitação <input id="imp-hab" value="${U.esc(res.meta.habilitacao)}"></label>
          <label>Ano <input id="imp-ano" value="${U.esc(res.meta.ano)}" inputmode="numeric"></label>
        </div>` : ''}
        ${res.tipo === 'alunos' ? `<p class="dica">${novos} novo(s) · ${transf} mudança(s) de turma · ${res.registros.length - novos - transf} já cadastrado(s)</p>
          <label class="check"><input type="checkbox" id="imp-inativar"> Marcar como inativos os alunos desta turma que não estão na planilha (transferidos). O histórico é mantido.</label>` : ''}
        ${res.tipo === 'frequencia' ? `<p class="dica">Componentes: ${res.disciplinas.map(U.esc).join(', ')}</p>` : ''}
        ${semCadastro ? `<p class="alerta">⚠ ${semCadastro} RM(s) ainda não cadastrados. Importe a Relação de Alunos também.</p>` : ''}
        ${res.alertas.map((a) => `<p class="alerta">⚠ ${U.esc(a)}</p>`).join('')}
        <div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>RM</th><th>Nome</th><th>${res.tipo === 'frequencia' ? 'Freq. acum.' : res.tipo === 'contatos' ? 'Telefone' : 'Grupo'}</th></tr></thead>
          <tbody>${amostra.map((r) => `<tr><td>${r.rm}</td><td>${U.esc(r.nome || (D.S.alunos[r.rm] || {}).nome || '')}</td>
            <td>${res.tipo === 'frequencia' ? U.fmtPct(r.freqAcumulada) : U.esc(res.tipo === 'contatos' ? r.telefone : r.grupo)}</td></tr>`).join('')}</tbody>
        </table></div>
        ${res.registros.length > 5 ? `<p class="dica">… e mais ${res.registros.length - 5}</p>` : ''}
        <button class="btn btn-primario btn-grande btn-bloco" id="imp-confirmar">Confirmar importação</button>
        <button class="btn btn-sec btn-bloco" id="imp-cancelar">Cancelar</button>
      </div>`;

    U.$('#imp-cancelar').onclick = () => { box.hidden = true; U.$('#arquivo').value = ''; };
    U.$('#imp-confirmar').onclick = async (ev) => {
      const btn = ev.currentTarget;
      if (res.tipo !== 'contatos') {
        const serie = U.$('#imp-serie').value.replace(/\D/g, ''), turma = U.$('#imp-turma').value.trim().toUpperCase();
        const hab = U.$('#imp-hab').value.trim().toUpperCase(), ano = U.$('#imp-ano').value.trim();
        if (!serie || !turma) { U.toast('Informe a série e a turma.', 'erro'); return; }
        res.registros.forEach((r) => {
          if (!r.serie || r.serie === res.meta.serie) r.serie = serie;
          if (!r.turma || r.turma === res.meta.turma) r.turma = turma;
          if (!r.habilitacao || r.habilitacao === res.meta.habilitacao) r.habilitacao = hab;
          r.ano = ano;
        });
      }
      if (!D.DEMO && !navigator.onLine) { U.toast('A importação precisa de internet.', 'erro'); return; }
      btn.disabled = true; btn.textContent = 'Importando…';
      try {
        let r, msg;
        if (res.tipo === 'alunos') {
          r = await D.importarAlunos(res.registros, U.$('#imp-inativar').checked);
          msg = `${r.novos} novo(s), ${r.atualizados} atualizado(s), ${r.transferidos} transferido(s)${r.inativados ? `, ${r.inativados} inativado(s)` : ''}.`;
        } else if (res.tipo === 'frequencia') {
          r = await D.importarFrequencia(res.registros);
          msg = `Frequência de ${r.novos + r.atualizados} aluno(s) atualizada.`;
        } else {
          let n = 0;
          res.registros.forEach((c) => {
            if (D.S.alunos[c.rm] && c.telefone) { D.salvarContato(c.rm, c.nomeResponsavel || D.S.alunos[c.rm].nomeResponsavel || '', c.telefone); n++; }
          });
          msg = `${n} contato(s) atualizados.`;
        }
        box.innerHTML = `<div class="cartao sucesso">✅ Importação concluída<br>${U.esc(msg)}<br><small>Histórico de presenças preservado.</small></div>`;
        U.$('#arquivo').value = '';
        App.atualizarTudo();
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Confirmar importação';
        U.toast('Erro: ' + e.message, 'erro');
      }
    };
  };

  window.Importador = I;
})();
