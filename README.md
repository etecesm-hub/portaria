# Chamada da Portaria — Etec da Zona Leste / Extensão CEU São Miguel

App (PWA) para registrar a entrada dos alunos do 1º, 2º e 3º ano pelo QR Code da carteirinha.
Ele roda no navegador do celular (Android e iPhone), funciona sem internet e guarda tudo numa
**Planilha Google**, sem servidor e sem custo.

| O que faz | Como |
|---|---|
| Leitura do QR Code (RM) | Câmera traseira, biblioteca open-source `html5-qrcode`. Busca o aluno, a turma e a série sozinho |
| RM digitado | Campo numérico logo abaixo da câmera |
| Horário | Até **18:40** = "No horário" · a partir de 18:41 = "Atrasado" |
| Vários celulares | Cada pessoa usa o seu aparelho. Eles sincronizam a cada 20 s pela planilha |
| Sem internet | Salva no aparelho, mostra o aviso "Offline" e envia sozinho quando a conexão volta. Nada se perde e nada duplica |
| Login | Usuário e senha para cada pessoa (perfil **admin** ou **coordenador**) |
| Importação | Relação de Alunos, Lista de Frequência (por componente) e Contatos, em .xlsx, .xls ou .csv. O **RM é a chave** e o histórico é preservado |
| PDF | Relatório individual, da turma e **diário da portaria**, com pré-visualização no app, botão Baixar e Compartilhar (no celular) |
| Excel | Os mesmos relatórios em .xlsx (aluno, turma, dia) + planilha de contatos já preenchida com os alunos |
| Usuários | O admin cria, bloqueia e troca senhas pelo app. Cada pessoa pode alterar a própria senha |
| WhatsApp | Envio individual ou em fila (atraso, falta, frequência baixa), com registro de "Aviso enviado", data/hora e operador |

---

## 1. Estrutura dos arquivos

```
chamada-portaria/
├── index.html              ← telas do app
├── manifest.webmanifest    ← dados de instalação (nome, ícone, cor)
├── sw.js                   ← service worker (funcionamento offline)
├── css/style.css
├── js/
│   ├── config.js           ← ⚙️ CONFIGURAÇÕES (URL da planilha, horário, mensagens, disciplinas)
│   ├── util.js             ← funções gerais (datas, som, vibração)
│   ├── dados.js            ← armazenamento local, fila offline e sincronização
│   ├── scanner.js          ← leitor de QR Code
│   ├── importar.js         ← leitura das planilhas da Secretaria
│   ├── pdf.js              ← relatórios em PDF + pré-visualização
│   ├── excel.js            ← relatórios em Excel e modelo de contatos
│   ├── usuarios.js         ← gestão de usuários e troca de senha
│   ├── whatsapp.js         ← mensagens wa.me e fila de envio
│   └── app.js              ← interface
├── icons/                  ← ícones do app e logos Etec / CPS (usados no PDF)
└── apps-script/
    ├── code.gs             ← backend (colar no Google Apps Script)
    └── appsscript.json     ← manifesto do Apps Script (fuso de São Paulo)
```

---

## 2. Testar antes de configurar (modo demonstração)

Com `API_URL: ''` no `js/config.js`, o app abre em **modo demonstração**: os dados ficam só naquele
aparelho e o login é **admin / admin**. Use esse modo para importar as planilhas e conhecer as telas.

No computador, dentro da pasta `chamada-portaria`, rode:

```bash
python -m http.server 8765
```

Depois abra `http://localhost:8765` no navegador. A câmera funciona em `localhost`. Fora dele, o app
precisa de **HTTPS** (veja o passo 5).

---

## 3. Criar a planilha com o e-mail do sistema

1. Entre no Google com o **novo e-mail dedicado do sistema** (por exemplo `portaria.etec...@gmail.com`).
   Use uma janela anônima se o seu e-mail pessoal estiver logado.
2. Abra <https://sheets.google.com> e crie uma **planilha em branco**. Dê o nome
   `Chamada Portaria – Etec ZL CEU São Miguel`.
3. Não compartilhe a planilha com ninguém. Ela tem dados de alunos menores de idade (**LGPD**).
   O app acessa a planilha sozinho; quem precisar consultar pode receber acesso de **leitor**.

## 4. Instalar o backend (Google Apps Script)

1. Na planilha, abra o menu **Extensões → Apps Script**.
2. Apague o conteúdo do arquivo `Código.gs` e **cole todo o `apps-script/code.gs`**.
3. Clique em ⚙️ **Configurações do projeto** e marque *"Exibir arquivo de manifesto appsscript.json"*.
   Volte ao editor, abra o `appsscript.json` e substitua o conteúdo pelo nosso `apps-script/appsscript.json`.
4. **Senha do admin.** No início do `code.gs`, troque `DIGITE_A_SENHA_AQUI` pela senha do admin
   (mínimo 6 caracteres). Sem isso o `setup` não roda.

   ```js
   var USUARIOS_INICIAIS = [
     { usuario: 'aguinaldo', nome: 'Aguinaldo Vicente', senha: 'DIGITE_A_SENHA_AQUI', perfil: 'admin' }
   ];
   ```
   Os coordenadores são cadastrados depois pelo admin, no app (menu ☰ → **Usuários e senhas**).
   - **admin**: tudo, inclusive importar planilhas e gerenciar usuários.
   - **coordenador**: registra entradas, envia avisos e gera relatórios. Não importa planilhas nem
     gerencia usuários.
   - Se o script foi criado em script.google.com (e não pelo menu Extensões da planilha), confira a
     variável `PLANILHA_ID`: é o trecho da URL da planilha entre `/d/` e `/edit`.
5. Salve (💾). No seletor de funções no topo, escolha **`setup`** e clique em **Executar**.
6. O Google pede autorização: **Revisar permissões**, escolha o e-mail do sistema,
   depois **Avançado → Acessar (não seguro)** e **Permitir**. A mensagem aparece porque o script
   é seu e não foi publicado na loja; é o procedimento normal.
7. A planilha ganha as abas `Alunos`, `Presencas`, `Frequencia`, `FrequenciaHistorico`, `Avisos`,
   `Usuarios` e `Log`. As senhas ficam gravadas criptografadas (hash SHA-256 com salt).
   Depois do setup, **apague as senhas do código** e salve. Elas não são mais necessárias ali.

### Publicar como App da Web

1. Clique em **Implantar → Nova implantação**.
2. Em ⚙️ *Selecionar tipo*, escolha **App da Web**.
3. Preencha:
   - Descrição: `v1`
   - **Executar como: Eu** (o e-mail do sistema)
   - **Quem pode acessar: Qualquer pessoa**
4. Clique em **Implantar** e copie a **URL do app da Web**. Ela termina em `/exec`.
5. Teste colando a URL no navegador. Deve aparecer `{"ok":true,"app":"chamada-portaria",...}`.

> "Qualquer pessoa" é necessário para os celulares acessarem a planilha sem login do Google.
> A segurança fica por conta do **login do app**: sem token válido, o script não devolve nenhum dado.

### Ligar o app à planilha

Abra `js/config.js` e cole a URL:

```js
API_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
```

### Quando alterar o `code.gs` depois

Vá em **Implantar → Gerenciar implantações → ✏️ Editar**, escolha *Versão: Nova versão* e clique em
**Implantar**. A URL continua a mesma. Se você criar uma *nova implantação*, a URL muda.

---

## 5. Hospedar o app com HTTPS (grátis)

> ✅ **Instalação atual:** o app está publicado em **https://etecesm-hub.github.io/portaria/**
> (GitHub Pages, conta `etecesm-hub`, repositório público `etecesm-hub/portaria`, branch `main`).
> O backend é o projeto Apps Script **"Chamada Portaria - Backend"**, ligado à planilha
> **"Chamada Portaria – Etec ZL CEU São Miguel"** pelo `PLANILHA_ID`.

### Como atualizar o site (GitHub Pages)
1. Faça as alterações nos arquivos e aumente a versão na 1ª linha do `sw.js`.
2. Dê dois cliques em **`Publicar atualizacao.bat`** (dentro de `chamada-portaria`). Ele envia as
   mudanças para o GitHub. Em 1 a 3 minutos o site está atualizado.
3. Na primeira vez num computador novo, o GitHub pede login: escolha entrar **com código** e digite
   o código em github.com/login/device estando logado como **etecesm-hub** (não use outra conta).

O `.gitignore` impede que o backend (`apps-script/`), planilhas e ferramentas locais vão para o
repositório público. ⚠️ **Nunca** envie planilhas de alunos (.xlsx/.csv) para o GitHub.

A câmera só funciona em HTTPS. Para montar em outro lugar, as duas opções abaixo são gratuitas.

### Opção A — GitHub Pages (a usada nesta instalação)
1. Crie uma conta no GitHub com o e-mail do sistema.
2. Crie um repositório novo e público, por exemplo `portaria` (o código não tem dados de alunos).
3. Envie os arquivos (git push, ou **Add file → Upload files**), sem a pasta `apps-script/`.
4. Em **Settings → Pages**, escolha *Source: Deploy from a branch*, *Branch: main / (root)* e salve.
   Confira se a página passa a dizer *"Your GitHub Pages site is currently being built"*.
5. Em 1 a 3 minutos o app estará em `https://SEU-USUARIO.github.io/portaria/`.

### Opção B — Netlify
Funciona, mas o plano gratuito coloca o selo **"Powered by Netlify"** no canto inferior direito,
em cima do menu do app. Para usar: crie a conta, rode `Gerar pacote Netlify.bat`, envie o
`portaria-netlify.zip` em *"Upload your project files"* e clique em **Make public** (projetos novos
começam privados).

### Atualizar o app nos celulares
Sempre que mudar arquivos do app, aumente a versão na 1ª linha do `sw.js`
(`portaria-v1.0.0` → `portaria-v1.0.1`) e publique de novo. Os celulares baixam a versão nova
na próxima vez que o app for aberto e fechado.

---

## 6. Instalar nos celulares da portaria

| Android (Chrome) | iPhone (Safari) |
|---|---|
| Abra o link → menu ⋮ → **Instalar app** (ou *Adicionar à tela inicial*) | Abra o link no **Safari** → botão **Compartilhar** → **Adicionar à Tela de Início** |

- No primeiro acesso, permita a **câmera**.
- O **primeiro login precisa de internet**. Depois o aparelho fica conectado por 30 dias, mesmo offline.
- Deixe o **relógio do celular em automático**. O status (no horário ou atrasado) usa a hora do aparelho
  no momento da leitura, inclusive offline.
- Na primeira abertura com internet, o app baixa tudo de que precisa para funcionar offline.

---

## 7. Primeiro uso (perfil admin)

1. Entre com o usuário **admin**.
2. Na aba **Importar**, envie a **Relação de Alunos** de cada turma, uma planilha por vez.
   - Série, turma, habilitação e ano são lidos do cabeçalho da Secretaria
     (`Habilitação: ... Turma: ... Ano: ... Módulo/Série: ...`). Confira na prévia antes de confirmar.
   - Para atualizar uma turma (novos alunos ou transferências), importe a lista nova. Alunos já
     existentes são atualizados pelo RM, quem mudou de turma é movido e **nenhuma presença é apagada**.
   - A opção *"Marcar como inativos os que não estão na planilha"* serve para transferidos. Eles saem
     das listas, mas o histórico fica guardado.
3. Envie a **Lista de Frequência** (por componente) de cada turma. Ela pode ser reimportada sempre
   que a Secretaria exportar uma nova; cada importação também fica guardada na aba
   `FrequenciaHistorico`.
   - Um componente com 0% para **todos** os alunos (ex.: LI) é tratado como *"sem aulas lançadas"*,
     não como falta.
4. **Telefones dos responsáveis** (as planilhas da Secretaria não trazem): há três formas.
   - Editar na ficha do aluno (aba **Alunos** → toque no nome); ou
   - Na aba **Importar**, tocar em **Baixar planilha de contatos**. Ela vem com RM, nome e turma de
     todos os alunos; preencha `RESPONSAVEL` e `TELEFONE` e importe de volta (linhas sem telefone são
     ignoradas); ou
   - Incluir as colunas `RESPONSAVEL` e `TELEFONE` na própria Relação de Alunos.

   Reimportar a Relação de Alunos **não apaga** telefones já cadastrados.

### Componentes curriculares
Os componentes aparecem pela **sigla da Secretaria** (ARTE, BIO, MAT…). Cada série/habilitação pode
ter componentes diferentes; o app lê as colunas que existirem na Lista de Frequência importada.

### Ano letivo
Algumas listas saem com o ano de ingresso no cabeçalho (ex.: 2º ano com `Ano: 2025`). O app ajusta
para o ano atual e avisa na prévia; os relatórios usam sempre o ano letivo corrente.

---

## 8. Uso diário na portaria

- **Portaria**: toque em *Ligar câmera* e aponte para a carteirinha. Aparece uma tela cheia
  **verde** (no horário), **laranja** (atrasado), **cinza** (já registrado hoje) ou **vermelha**
  (RM não encontrado), com som e vibração.
- **QR do aluno (próprio do sistema):** a carteirinha digital do Sistema NSA tem um QR que só
  traz um link de validação (muda todo dia e **não contém o RM**). Por isso o app gera o seu
  próprio QR, fixo, com o conteúdo `RM:27247`:
  - **Etiquetas A4 por turma:** aba **Alunos** → escolha a turma no filtro → **🏷 Etiquetas QR**.
    São 21 por folha, no formato Pimaco **A4256** (63,5 × 38,1 mm). Imprima em **tamanho real / 100%**
    (sem "ajustar à página"). Também serve papel comum: recorte pelo contorno.
  - **Imagem individual:** abra a ficha do aluno → **🔳 QR do aluno** → *Compartilhar* (WhatsApp…)
    ou *Baixar imagem*. O aluno pode guardar na galeria e mostrar na portaria.
- O leitor também aceita QR com só o número (`27247`), `RM: 27247` ou link com `?rm=27247`.
  Se ler o QR da carteirinha NSA, o app avisa e pede para digitar a matrícula.
- Se o aluno esqueceu a carteirinha, digite o RM no campo abaixo da câmera.
- O selo no topo mostra **Sincronizado**, **N a enviar** ou **Offline**. Toque nele para forçar o envio.
- **Dia**: atrasados, ausentes e no horário, por turma e por data.
  - 📲 envia o aviso individual pelo WhatsApp.
  - **Avisar responsáveis em fila** abre uma mensagem por vez: toque, envie no WhatsApp, volte ao
    app e toque no próximo. Os navegadores não permitem abrir várias conversas de uma vez.
  - Quem já foi avisado aparece com ✔ *"Aviso enviado 10/11/2026 19:02 · aguinaldo"*, em todos os
    celulares. Reenviar pede confirmação.
- **Alunos**: busca, ficha completa, **Relatório PDF** individual, **PDF da turma** (escolha a turma
  no filtro) e **Avisar freq. baixa** (alunos abaixo de 75%).

---

## 9. Perguntas frequentes

**Como criar ou trocar a senha de alguém?**
Pelo app: menu ☰ → **Usuários e senhas** (só admin). Dá para criar, mudar perfil, bloquear e
definir uma senha nova (mínimo 6 caracteres). Bloquear ou trocar a senha desconecta os aparelhos
daquele usuário. O app não deixa remover o último admin ativo. Cada pessoa troca a própria senha em
menu ☰ → **Alterar minha senha**.
Se o admin perder o acesso, no Apps Script rode `criarUsuario('admin', 'Coordenação', 'novaSenha', 'admin')`.

**Relatório do dia**
Aba **Dia** → escolha a data (e a turma, ou todas) → **📄 PDF** ou **📊 Excel**. Mostra o resumo por
turma, os atrasados com horário e os alunos sem entrada, com a situação do aviso ao responsável.

**Dois aparelhos leram o mesmo aluno ao mesmo tempo?**
Vale o primeiro registro que chega à planilha. O outro aparelho descarta o seu na próxima
sincronização, sem duplicar.

**O celular ficou sem internet a noite toda?**
Tudo fica salvo no aparelho, com a hora real da leitura. O envio acontece sozinho quando a internet
volta. Não saia do app nem limpe os dados do navegador antes de o selo mostrar *Sincronizado*.

**Posso mudar o horário de 18:40 ou as mensagens?**
Sim, em `js/config.js` (`HORARIO_LIMITE` e `MENSAGENS`). No `code.gs` o horário é só informativo.

**Limites do Google:** o plano gratuito do Apps Script suporta com folga uma escola com várias
centenas de alunos e alguns celulares sincronizando a cada 20 s. A planilha comporta milhões de células,
o que dá vários anos de histórico.

**Ausentes:** a aba *Dia* considera ausente o aluno ativo sem entrada registrada naquele dia. Antes
das 18:40 a lista ainda muda (o app avisa). No PDF, "Sem entrada registrada" conta só os dias em que
a portaria registrou alguma entrada (dias letivos).

---

## 10. Privacidade (LGPD)

- Os dados ficam na planilha do e-mail do sistema e no armazenamento local dos celulares autorizados.
- Use senhas fortes e não compartilhe o login entre pessoas: cada registro grava quem o fez.
- Ao sair, os dados de cadastro continuam no aparelho para uso offline. Em celular que deixar de ser
  usado pela escola, limpe os dados do site nas configurações do navegador.
