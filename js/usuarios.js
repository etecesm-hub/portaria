/* Gestão de usuários (admin) e troca da própria senha */
(function () {
  const { $, esc } = U;
  const Us = {};

  Us.alterarSenha = function () {
    App.abrirPainel(`
      <h2>Alterar minha senha</h2>
      <p class="dica">Ao trocar, os outros aparelhos conectados com o seu usuário serão desconectados.</p>
      <form id="form-senha">
        <label>Senha atual <input id="sn-atual" type="password" autocomplete="current-password" required></label>
        <label>Nova senha (mínimo 6) <input id="sn-nova" type="password" autocomplete="new-password" minlength="6" required></label>
        <label>Repita a nova senha <input id="sn-conf" type="password" autocomplete="new-password" minlength="6" required></label>
        <p id="sn-erro" class="erro"></p>
        <button class="btn btn-primario btn-bloco" type="submit">Salvar nova senha</button>
      </form>`);
    $('#form-senha').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nova = $('#sn-nova').value;
      if (nova !== $('#sn-conf').value) { $('#sn-erro').textContent = 'As senhas novas não conferem.'; return; }
      const btn = e.submitter; btn.disabled = true;
      try {
        await D.alterarSenha($('#sn-atual').value, nova);
        App.fecharPainel(); U.toast('Senha alterada ✔');
      } catch (err) { $('#sn-erro').textContent = err.message; btn.disabled = false; }
    });
  };

  Us.abrirGestao = async function () {
    App.abrirPainel('<h2>Usuários</h2><p class="dica">Carregando…</p>');
    try { render(await D.listarUsuarios()); }
    catch (err) { App.abrirPainel(`<h2>Usuários</h2><p class="erro">${esc(err.message)}</p>`); }
  };

  function render(lista) {
    App.abrirPainel(`
      <h2>Usuários</h2>
      <p class="dica"><b>admin</b>: tudo, inclusive importar planilhas e gerenciar usuários. <b>coordenador</b>: portaria, avisos e relatórios (sem importar nem gerenciar usuários).</p>
      <ul class="lista">${lista.map((u) => `
        <li class="item ${u.ativo ? 'ok' : 'falta'}" data-u="${esc(u.usuario)}">
          <div class="item-corpo"><b>${esc(u.nome)}</b><span>${esc(u.usuario)} · ${u.perfil}${u.ativo ? '' : ' · <b>bloqueado</b>'}</span></div>
          <div class="item-fim"><span class="selo">Editar</span></div>
        </li>`).join('')}</ul>
      <button class="btn btn-primario btn-bloco" id="us-novo">+ Novo usuário</button>`);
    U.$$('#painel-conteudo [data-u]').forEach((li) => li.addEventListener('click', () => editar(lista.find((u) => u.usuario === li.dataset.u), lista)));
    $('#us-novo').onclick = () => editar(null, lista);
  }

  function editar(u, lista) {
    const novo = !u;
    const eu = u && u.usuario === D.S.sessao.usuario;
    App.abrirPainel(`
      <h2>${novo ? 'Novo usuário' : 'Editar ' + esc(u.usuario)}</h2>
      <form id="form-us" class="grade-campos">
        <label class="larga">Nome <input id="us-nome" value="${esc(u ? u.nome : '')}" required></label>
        <label class="larga">Usuário (login) <input id="us-login" value="${esc(u ? u.usuario : '')}" ${novo ? '' : 'readonly'} autocapitalize="none" pattern="[a-zA-Z0-9._\\-]{3,30}" required></label>
        <label>Perfil
          <select id="us-perfil" ${eu ? 'disabled' : ''}>
            <option value="coordenador" ${u && u.perfil !== 'admin' ? 'selected' : ''}>coordenador</option>
            <option value="admin" ${u && u.perfil === 'admin' ? 'selected' : ''}>admin</option>
          </select></label>
        <label>Situação
          <select id="us-ativo" ${eu ? 'disabled' : ''}>
            <option value="1" ${!u || u.ativo ? 'selected' : ''}>ativo</option>
            <option value="0" ${u && !u.ativo ? 'selected' : ''}>bloqueado</option>
          </select></label>
        <label class="larga">${novo ? 'Senha (mínimo 6)' : 'Nova senha (deixe em branco para manter)'}
          <input id="us-senha" type="text" autocomplete="off" ${novo ? 'required minlength="6"' : ''}></label>
        <p id="us-erro" class="erro larga"></p>
        <button class="btn btn-primario larga" type="submit">Salvar</button>
        <button class="btn btn-sec larga" type="button" id="us-voltar">Voltar</button>
      </form>
      ${eu ? '<p class="dica">Você não pode bloquear nem tirar o perfil admin de si mesmo.</p>' : ''}
      <p class="dica">Bloquear ou trocar a senha desconecta os aparelhos desse usuário.</p>`);
    $('#us-voltar').onclick = () => render(lista);
    $('#form-us').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.submitter; btn.disabled = true; btn.textContent = 'Salvando…';
      try {
        const nova = await D.salvarUsuario({
          usuario: $('#us-login').value.trim().toLowerCase(), nome: $('#us-nome').value.trim(),
          perfil: $('#us-perfil').value, ativo: $('#us-ativo').value === '1', senha: $('#us-senha').value
        });
        U.toast('Usuário salvo ✔');
        render(nova);
      } catch (err) { $('#us-erro').textContent = err.message; btn.disabled = false; btn.textContent = 'Salvar'; }
    });
  }

  window.Usuarios = Us;
})();
