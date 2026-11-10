/* Utilitários gerais */
(function () {
  const U = {};

  U.$ = (sel, ctx) => (ctx || document).querySelector(sel);
  U.$$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  U.uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }));

  const dois = (n) => String(n).padStart(2, '0');
  U.dataStr = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
  U.hojeStr = () => U.dataStr(new Date());
  U.horaStr = (d) => { d = d || new Date(); return `${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`; };
  U.agoraIso = () => `${U.hojeStr()}T${U.horaStr()}`;
  U.fmtData = (iso) => { if (!iso) return ''; const [a, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
  U.fmtDataHora = (iso) => iso ? `${U.fmtData(iso)} ${iso.slice(11, 16)}` : '';
  U.diaSemana = (iso) => ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][new Date(iso + 'T12:00:00').getDay()];
  U.dataExtenso = (d) => {
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
  };

  /** "No horário" se HH:MM <= limite (o minuto 18:40 inteiro conta como no horário) */
  U.statusPorHora = (hora) => (hora.slice(0, 5) <= CONFIG.HORARIO_LIMITE ? 'No horário' : 'Atrasado');

  U.semAcento = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  U.norm = (s) => U.semAcento(s).toUpperCase().replace(/\s+/g, ' ').trim();

  U.normalizarRM = (txt) => {
    const s = String(txt == null ? '' : txt).trim();
    const m = s.match(/\d{3,}/);           // aceita QR com texto/URL contendo o RM
    return m ? m[0].replace(/^0+(?=\d)/, '') : '';
  };

  /** "NOVOTEC N - ADMINISTRAÇÃO" -> "ADMINISTRAÇÃO" */
  U.curso = (hab) => { const p = String(hab || '').split(' - '); return p[p.length - 1].trim(); };
  U.chaveTurma = (a) => `${a.serie}|${a.turma}|${a.habilitacao}`;
  U.rotuloTurma = (a) => a ? `${a.serie}º ${U.curso(a.habilitacao)} – ${String(a.turma || '').replace(/^TURMA\s*/i, 'Turma ')}`.trim() : '';
  U.primeiroNome = (n) => { const p = String(n || '').trim().split(/\s+/)[0] || ''; return p.charAt(0) + p.slice(1).toLowerCase(); };
  U.nomeProprio = (n) => String(n || '').toLowerCase().replace(/(^|\s)(\S)/g, (m, e, c) => e + c.toUpperCase()).replace(/\s(De|Da|Do|Dos|Das|E)\s/g, (m) => m.toLowerCase());

  U.fmtPct = (v) => (v == null || v === '' || isNaN(v)) ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

  // ---------- Toast ----------
  let tToast;
  U.toast = (msg, tipo) => {
    const t = U.$('#toast');
    t.textContent = msg;
    t.className = 'toast ' + (tipo || '');
    t.hidden = false;
    clearTimeout(tToast);
    tToast = setTimeout(() => { t.hidden = true; }, 3500);
  };

  // ---------- Som / vibração ----------
  let ctx;
  U.liberarAudio = () => {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { /* sem áudio */ }
  };
  function tom(freq, ini, dur, tipo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + ini);
    g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + ini + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ini + dur);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + ini); o.stop(ctx.currentTime + ini + dur + 0.05);
  }
  U.feedback = (tipo) => {
    try {
      U.liberarAudio();
      if (ctx) {
        if (tipo === 'ok') { tom(880, 0, 0.12); tom(1320, 0.12, 0.18); }
        else if (tipo === 'atraso') { tom(660, 0, 0.18, 'triangle'); tom(660, 0.25, 0.18, 'triangle'); tom(440, 0.5, 0.3, 'triangle'); }
        else if (tipo === 'repetido') { tom(520, 0, 0.15); }
        else { tom(220, 0, 0.45, 'square'); }
      }
    } catch (e) { /* ignore */ }
    if (navigator.vibrate) navigator.vibrate(tipo === 'ok' ? 80 : tipo === 'atraso' ? [120, 80, 120] : [300]);
  };

  window.U = U;
})();
