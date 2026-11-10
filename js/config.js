/* ==========================================================================
   CONFIGURAÇÃO DO SISTEMA — edite aqui
   ========================================================================== */
window.CONFIG = {
  /* URL do App da Web do Google Apps Script (termina em /exec).
     Deixe vazio ('') para usar o MODO DEMONSTRAÇÃO (dados só no aparelho, login admin/admin). */
  API_URL: 'https://script.google.com/macros/s/AKfycbwoZOsVfxCiPTVSo2LtSBgIbNjcQMfgv-4Rtre-kyvXSALse3bZzD7x0AENNgMdXGKR/exec',

  /* Até este horário (inclusive o minuto inteiro) = "No horário". Depois = "Atrasado". */
  HORARIO_LIMITE: '18:40',

  /* Frequência mínima exigida (%) */
  FREQ_MINIMA: 75,

  /* Intervalo de sincronização automática entre aparelhos (segundos) */
  SYNC_SEGUNDOS: 20,

  ESCOLA: {
    mantenedora: 'Centro Estadual de Educação Tecnológica Paula Souza',
    nome: 'Etec da Zona Leste',
    extensao: 'Extensão CEU São Miguel',
    endereco: 'Av. Águia de Haia, 2633 – Cidade Antônio Estêvão de Carvalho – São Paulo/SP – CEP 03694-000',
    telefone: '(11) 2045-4000',
    cidade: 'São Paulo'
  },


  /* Mensagens de WhatsApp. Variáveis: {responsavel} {aluno} {primeiroNome} {rm} {turma}
     {data} {hora} {limite} {freq} {faltas} {escola} {telefoneEscola} */
  MENSAGENS: {
    atraso:
      'Olá, {responsavel}! A {escola} informa que o(a) aluno(a) *{aluno}* (RM {rm} – {turma}) ' +
      'chegou *atrasado(a)* hoje, {data}, às *{hora}*. O portão fecha às {limite}. ' +
      'Em caso de dúvidas, entre em contato pelo telefone {telefoneEscola}.',
    falta:
      'Olá, {responsavel}! A {escola} informa que o(a) aluno(a) *{aluno}* (RM {rm} – {turma}) ' +
      '*não registrou entrada* na escola hoje, {data}. ' +
      'Se houver justificativa, por favor procure a secretaria ou ligue {telefoneEscola}.',
    frequencia:
      'Olá, {responsavel}! A {escola} informa que o(a) aluno(a) *{aluno}* (RM {rm} – {turma}) ' +
      'está com frequência acumulada de *{freq}%* ({faltas} faltas), abaixo do mínimo de 75%. ' +
      'Pedimos que compareça ou entre em contato pelo telefone {telefoneEscola}.'
  }
};
