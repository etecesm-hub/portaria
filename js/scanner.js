/* Leitor de QR Code (html5-qrcode) — câmera traseira */
(function () {
  const L = {};
  let leitor = null, ligado = false, ultimo = '', ultimoEm = 0, pausado = false;
  let aoLer = null;

  L.ligado = () => ligado;

  L.ligar = async function (callback) {
    aoLer = callback || aoLer;
    if (ligado) return;
    if (!window.Html5Qrcode) { U.toast('Leitor de QR não carregou. Verifique a internet na primeira abertura.', 'erro'); return; }
    if (!leitor) leitor = new Html5Qrcode('leitor', { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] });
    const config = {
      fps: 12,
      qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.72); return { width: s, height: s }; },
      aspectRatio: 1.0,
      disableFlip: true
    };
    try {
      await leitor.start({ facingMode: 'environment' }, config, lido, () => {});
      ligado = true;
      U.$('#leitor-desligado').hidden = true;
    } catch (e) {
      console.error(e);
      U.$('#leitor-desligado').hidden = false;
      const msg = String(e).includes('Permission') || String(e).includes('NotAllowed')
        ? 'Permissão da câmera negada. Libere nas configurações do navegador.'
        : 'Não foi possível abrir a câmera. Use o campo de RM.';
      U.toast(msg, 'erro');
    }
  };

  L.desligar = async function () {
    if (!leitor || !ligado) return;
    try { await leitor.stop(); } catch (e) { /* já parado */ }
    ligado = false; pausado = false;
    U.$('#leitor-desligado').hidden = false;
  };

  function lido(texto) {
    const agora = Date.now();
    if (pausado) return;
    if (texto === ultimo && agora - ultimoEm < 4000) return; // mesma carteirinha parada na frente da câmera
    ultimo = texto; ultimoEm = agora;
    pausado = true;
    try { leitor.pause(true); } catch (e) { /* ok */ }
    try { aoLer && aoLer(texto); } finally {
      setTimeout(() => { pausado = false; try { leitor.resume(); } catch (e) { /* ok */ } }, 1400);
    }
  }

  // Economiza bateria: desliga a câmera quando o app vai para segundo plano
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) L.desligar();
    else if (window.App && App.abaAtual === 'portaria' && L.querLigado) L.ligar();
  });

  L.querLigado = false;
  window.Leitor = L;
})();
