(() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Configuração                                                        */
  /* ------------------------------------------------------------------ */

  const APP_NAME = 'Pulso CRM';
  const LEGACY_KEY = 'pulso-crm-v1'; // dados da primeira versão, que salvava só no navegador
  const CONFIG = window.PULSO_CONFIG || {};
  const APP_URL = location.origin + location.pathname;

  const STAGES = [
    { id: 'lead', name: 'Novo lead', color: '#64748b' },
    { id: 'qualificado', name: 'Qualificado', color: '#0ea5e9' },
    { id: 'proposta', name: 'Proposta', color: '#8b5cf6' },
    { id: 'negociacao', name: 'Negociação', color: '#f59e0b' },
    { id: 'ganho', name: 'Ganho', color: '#10b981', closed: true },
    { id: 'perdido', name: 'Perdido', color: '#ef4444', closed: true },
  ];
  const OPEN_STAGES = STAGES.filter((s) => !s.closed).map((s) => s.id);
  const TASK_TYPES = ['Ligação', 'WhatsApp', 'E-mail', 'Reunião', 'Follow-up', 'Outro'];

  /* ------------------------------------------------------------------ */
  /* Utilitários                                                         */
  /* ------------------------------------------------------------------ */

  const $ = (sel, root = document) => root.querySelector(sel);
  const uid = () => crypto.randomUUID();
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const sumValue = (deals) => deals.reduce((t, d) => t + (Number(d.value) || 0), 0);
  const elementOf = (e) => (e.target instanceof Element ? e.target : e.target && e.target.parentElement);

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const money = (v) => brl.format(Number(v) || 0);

  function parseMoney(text) {
    let s = String(text ?? '').replace(/[R$\s]/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  }

  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
  const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  const fmtShort = (iso) => { if (!iso) return ''; const [, m, d] = iso.split('-'); return `${d}/${m}`; };

  function dayDiff(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const now = new Date();
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  }

  function dueLabel(iso) {
    const diff = dayDiff(iso);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanhã';
    if (diff === -1) return 'Ontem';
    if (diff < -1) return `há ${-diff} dias`;
    return fmtShort(iso);
  }

  const initials = (name) => String(name || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
  const hue = (name) => { let h = 0; for (const ch of String(name || '')) h = (h * 31 + ch.codePointAt(0)) % 360; return h; };
  const avatar = (name, cls = '') => `<span class="avatar ${cls}" style="--h:${hue(name)}" aria-hidden="true">${esc(initials(name))}</span>`;

  function waLink(phone) {
    let digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length <= 11) digits = '55' + digits;
    return 'https://wa.me/' + digits;
  }

  /* ------------------------------------------------------------------ */
  /* Dados                                                               */
  /* ------------------------------------------------------------------ */

  function normalize(data) {
    const list = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && x.id) : []);
    return { contacts: list(data && data.contacts), deals: list(data && data.deals), tasks: list(data && data.tasks) };
  }

  function seed() {
    const c = (id, name, company, role, email, phone, notes = '') =>
      ({ id, name, company, role, email, phone, notes, createdAt: addDays(-40) });
    const d = (id, title, contactId, value, stage, expectedClose, closedAt = '') =>
      ({ id, title, contactId, value, stage, expectedClose, closedAt, notes: '', createdAt: addDays(-20) });
    const t = (id, title, type, due, contactId, done = false) => ({ id, title, type, due, contactId, done });

    return reId({
      contacts: [
        c('c1', 'Mariana Costa', 'Padaria Bom Trigo', 'Proprietária', 'mariana@bomtrigo.example', '(11) 98888-1001', 'Prefere contato por WhatsApp no período da tarde.'),
        c('c2', 'Rafael Nogueira', 'Nogueira Advocacia', 'Sócio', 'rafael@nogueiraadv.example', '(21) 97777-2002'),
        c('c3', 'Camila Duarte', 'Studio Duarte Pilates', 'Gestora', 'camila@studioduarte.example', '(31) 96666-3003'),
        c('c4', 'Thiago Almeida', 'Almeida Auto Peças', 'Gerente comercial', 'thiago@almeidapecas.example', '(41) 95555-4004'),
        c('c5', 'Juliana Prado', 'Clínica Sorriso Pleno', 'Administradora', 'juliana@sorrisopleno.example', '(51) 94444-5005'),
        c('c6', 'Bruno Teixeira', 'Teixeira Engenharia', 'Diretor', 'bruno@teixeiraeng.example', '(61) 93333-6006'),
        c('c7', 'Larissa Mendes', 'Mendes Contabilidade', 'Contadora', 'larissa@mendescont.example', '(71) 92222-7007'),
        c('c8', 'Felipe Araújo', 'Araújo Imóveis', 'Corretor', 'felipe@araujoimoveis.example', '(81) 91111-8008'),
      ],
      deals: [
        d('d1', 'Plano anual — Padaria Bom Trigo', 'c1', 4800, 'negociacao', addDays(5)),
        d('d2', 'Implantação para o escritório', 'c2', 12500, 'proposta', addDays(12)),
        d('d3', 'Pacote de 5 usuários', 'c3', 2900, 'qualificado', addDays(20)),
        d('d4', 'Integração com estoque', 'c4', 8700, 'lead', addDays(30)),
        d('d5', 'Plano clínica + treinamento', 'c5', 6400, 'proposta', addDays(-2)),
        d('d6', 'Contrato corporativo', 'c6', 24000, 'qualificado', addDays(25)),
        d('d7', 'Plano mensal', 'c7', 1800, 'lead', addDays(15)),
        d('d8', 'Renovação anual', 'c8', 5200, 'ganho', addDays(-3), addDays(-3)),
        d('d9', 'Pacote inicial', 'c1', 1500, 'ganho', addDays(-9), addDays(-9)),
        d('d10', 'Consultoria de implantação', 'c4', 3600, 'perdido', addDays(-6), addDays(-6)),
      ],
      tasks: [
        t('t1', 'Enviar proposta revisada', 'E-mail', addDays(0), 'c2'),
        t('t2', 'Ligar para confirmar fechamento', 'Ligação', addDays(-1), 'c1'),
        t('t3', 'Agendar demonstração', 'Reunião', addDays(2), 'c6'),
        t('t4', 'Retomar conversa sobre a proposta', 'WhatsApp', addDays(1), 'c5'),
        t('t5', 'Enviar material de apresentação', 'E-mail', addDays(4), 'c7'),
        t('t6', 'Mensagem de boas-vindas', 'WhatsApp', addDays(-3), 'c8', true),
      ],
    });
  }

  const emptyDb = () => ({ contacts: [], deals: [], tasks: [] });

  /** Gera ids novos para tudo, preservando a ligação de negócios e tarefas com os contatos. */
  function reId(data) {
    const map = new Map();
    const contacts = data.contacts.map((c) => { const id = uid(); map.set(c.id, id); return { ...c, id }; });
    const relink = (x) => ({ ...x, id: uid(), contactId: map.get(x.contactId) || '' });
    return { contacts, deals: data.deals.map(relink), tasks: data.tasks.map(relink) };
  }

  /** Dados deixados neste navegador pela versão sem login, se houver. */
  function legacyData() {
    try {
      const data = normalize(JSON.parse(localStorage.getItem(LEGACY_KEY)));
      return data.contacts.length + data.deals.length + data.tasks.length ? data : null;
    } catch (err) {
      return null;
    }
  }

  let db = emptyDb();
  const ui = { contactQuery: '', taskFilter: 'pendentes', authMode: 'login', authEmail: '' };

  /* ------------------------------------------------------------------ */
  /* Nuvem (Supabase)                                                    */
  /* ------------------------------------------------------------------ */

  // Contatos primeiro: negócios e tarefas apontam para eles.
  const TABLE_NAMES = ['contacts', 'deals', 'tasks'];
  const PAGE = 1000;

  let sb = null;           // cliente Supabase
  let user = null;         // usuário logado
  let loadState = 'none';  // none | loading | ready
  let loadedAt = 0;
  let version = 0;         // aumenta a cada alteração local
  let pending = 0;         // envios na fila
  let dirty = false;       // o último envio falhou
  let recovering = false;  // usuário chegou por um link de recuperação de senha
  let bootMessage = '';
  let syncChain = Promise.resolve();
  let synced = { contacts: new Map(), deals: new Map(), tasks: new Map() }; // o que já está na nuvem

  const str = (v, max = 200) => String(v ?? '').slice(0, max);
  const day = (v) => String(v || '').slice(0, 10);
  const validDate = (v) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return null;
    const d = new Date(v + 'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
  };
  const linkedContact = (id) => (id && db.contacts.some((c) => c.id === id) ? id : null);

  // Conversão entre os objetos do app e as linhas do banco. toRow também higieniza
  // o que vem de importações, para que uma linha inválida não trave o envio inteiro.
  const TABLES = {
    contacts: {
      toRow: (c) => ({
        id: c.id, name: str(c.name) || 'Sem nome', company: str(c.company), role: str(c.role),
        email: str(c.email), phone: str(c.phone), notes: str(c.notes, 5000),
      }),
      fromRow: (r) => ({
        id: r.id, name: r.name, company: r.company, role: r.role, email: r.email,
        phone: r.phone, notes: r.notes, createdAt: day(r.created_at),
      }),
    },
    deals: {
      toRow: (d) => ({
        id: d.id, contact_id: linkedContact(d.contactId), title: str(d.title) || 'Sem título',
        value: Math.round(Math.min(Math.max(Number(d.value) || 0, 0), 999999999999) * 100) / 100,
        stage: STAGES.some((s) => s.id === d.stage) ? d.stage : 'lead',
        expected_close: validDate(d.expectedClose), closed_at: validDate(d.closedAt), notes: str(d.notes, 5000),
      }),
      fromRow: (r) => ({
        id: r.id, contactId: r.contact_id || '', title: r.title, value: Number(r.value) || 0, stage: r.stage,
        expectedClose: r.expected_close || '', closedAt: r.closed_at || '', notes: r.notes, createdAt: day(r.created_at),
      }),
    },
    tasks: {
      toRow: (t) => ({
        id: t.id, contact_id: linkedContact(t.contactId), title: str(t.title) || 'Sem título',
        type: str(t.type, 50), due: validDate(t.due), done: Boolean(t.done),
      }),
      fromRow: (r) => ({
        id: r.id, contactId: r.contact_id || '', title: r.title, type: r.type, due: r.due || '', done: r.done,
      }),
    },
  };

  const chunks = (list, size) => {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  };
  const snapshot = (table) => new Map(db[table].map((item) => {
    const row = TABLES[table].toRow(item);
    return [row.id, JSON.stringify(row)];
  }));

  async function fetchAll(table) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb.from(table).select('*').order('created_at').order('id').range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < PAGE) return rows;
    }
  }

  async function fetchData() {
    const [contacts, deals, tasks] = await Promise.all(TABLE_NAMES.map(fetchAll));
    return { contacts, deals, tasks };
  }

  function applyData(rows) {
    db = emptyDb();
    for (const t of TABLE_NAMES) db[t] = rows[t].map(TABLES[t].fromRow);
    for (const t of TABLE_NAMES) synced[t] = snapshot(t);
    loadedAt = Date.now();
  }

  /** Envia para a nuvem só o que mudou desde o último envio. */
  async function pushChanges() {
    if (!user) return;
    const plan = {};
    for (const t of TABLE_NAMES) {
      const rows = db[t].map(TABLES[t].toRow);
      const now = new Map(rows.map((r) => [r.id, JSON.stringify(r)]));
      plan[t] = {
        now,
        upserts: rows.filter((r) => synced[t].get(r.id) !== now.get(r.id)),
        deletes: [...synced[t].keys()].filter((id) => !now.has(id)),
      };
    }
    for (const t of TABLE_NAMES) {
      for (const batch of chunks(plan[t].upserts, 500)) {
        const { error } = await sb.from(t).upsert(batch);
        if (error) throw error;
        batch.forEach((r) => synced[t].set(r.id, plan[t].now.get(r.id)));
      }
    }
    for (const t of [...TABLE_NAMES].reverse()) {
      for (const batch of chunks(plan[t].deletes, 100)) {
        const { error } = await sb.from(t).delete().in('id', batch);
        if (error) throw error;
        batch.forEach((id) => synced[t].delete(id));
      }
    }
  }

  /** Registra uma alteração local e agenda o envio para a nuvem. */
  function save() {
    if (!user) return;
    version++;
    pending++;
    syncChain = syncChain.then(async () => {
      try {
        await pushChanges();
        dirty = false;
      } catch (err) {
        dirty = true;
        console.error('Falha ao salvar na nuvem:', err);
        if (user) toast('Não foi possível salvar na nuvem. Verifique sua conexão.');
      } finally {
        pending--;
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Login                                                               */
  /* ------------------------------------------------------------------ */

  const AUTH_COPY = {
    login: ['Entrar', 'Acesse seu CRM com e-mail e senha.', 'Entrar'],
    signup: ['Criar conta', 'Comece a organizar suas vendas em poucos minutos.', 'Criar conta'],
    forgot: ['Recuperar senha', 'Enviaremos um link para você criar uma nova senha.', 'Enviar link'],
    recovery: ['Nova senha', 'Escolha uma nova senha para a sua conta.', 'Salvar senha'],
  };

  const AUTH_ERRORS = [
    [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
    [/email not confirmed/i, 'Confirme seu e-mail pelo link que enviamos antes de entrar.'],
    [/already registered/i, 'Já existe uma conta com este e-mail.'],
    [/not authorized/i, 'O cadastro ainda não está aberto para este e-mail.'],
    [/rate limit|too many|security purposes/i, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'],
    [/different from the old/i, 'A nova senha precisa ser diferente da anterior.'],
    [/password/i, 'Escolha uma senha mais forte, com pelo menos 8 caracteres.'],
    [/invalid.*email|email.*invalid/i, 'Confira o e-mail digitado.'],
    [/failed to fetch|network/i, 'Sem conexão com o servidor. Verifique sua internet.'],
  ];
  const authError = (err) => {
    const found = AUTH_ERRORS.find(([re]) => re.test((err && err.message) || ''));
    return found ? found[1] : 'Não foi possível concluir. Tente novamente.';
  };

  function show(screen) {
    $('#loading').hidden = screen !== 'loading';
    $('#auth').hidden = screen !== 'auth';
    $('.app').hidden = screen !== 'app';
  }

  function authMsg(text, ok = false) {
    const el = $('#auth-msg');
    if (!el) return;
    el.textContent = text;
    el.hidden = !text;
    el.classList.toggle('is-ok', ok);
  }

  function renderAuth() {
    const mode = ui.authMode;
    const [title, lead, action] = AUTH_COPY[mode];
    const link = (to, label) => `<button type="button" class="link" data-action="auth-mode" data-mode="${to}">${label}</button>`;
    const links = {
      login: link('signup', 'Criar uma conta') + link('forgot', 'Esqueci minha senha'),
      signup: `<span><span class="muted">Já tem conta?</span> ${link('login', 'Entrar')}</span>`,
      forgot: link('login', 'Voltar para o login'),
      recovery: '',
    }[mode];
    const email = mode === 'recovery' ? '' : field('E-mail',
      `<input name="email" type="email" required maxlength="160" autocomplete="email" value="${esc(ui.authEmail)}">`);
    const password = mode === 'forgot' ? '' : field(mode === 'login' ? 'Senha' : 'Senha (mínimo de 8 caracteres)',
      `<input name="password" type="password" required maxlength="72" ${mode === 'login' ? 'autocomplete="current-password"' : 'minlength="8" autocomplete="new-password"'}>`);

    $('#auth').innerHTML = `<div class="auth-card">
      <div class="brand">${$('.sidebar .brand').innerHTML}</div>
      <h1>${title}</h1>
      <p class="muted">${lead}</p>
      <form data-form="auth" class="auth-form">
        ${email}${password}
        <p id="auth-msg" class="auth-msg" role="alert" hidden></p>
        <button type="submit" class="btn btn-primary">${action}</button>
      </form>
      <div class="auth-links">${links}</div>
    </div>`;
  }

  /** Abre o CRM para a sessão informada, carregando os dados da conta. */
  async function enter(session) {
    const same = user && user.id === session.user.id;
    user = session.user;
    if (same && loadState !== 'none') {
      if (loadState === 'ready' && !recovering && $('.app').hidden) { show('app'); render(); }
      return;
    }
    loadState = 'loading';
    show('loading');
    let rows;
    try {
      rows = await fetchData();
    } catch (err) {
      console.error('Falha ao carregar os dados:', err);
      if (user && user.id === session.user.id) {
        user = null;
        loadState = 'none';
        show('auth');
        renderAuth();
        authMsg('Não foi possível carregar seus dados. Verifique sua conexão e entre de novo.');
      }
      return;
    }
    if (!user || user.id !== session.user.id) return; // saiu ou trocou de conta enquanto carregava
    applyData(rows);
    loadState = 'ready';
    $('#account-email').textContent = user.email || '';
    if (recovering) return;
    show('app');
    render();
  }

  /** Volta para a tela de login e limpa os dados da memória. */
  function leave() {
    if (!user && !$('#auth').hidden) return;
    user = null;
    loadState = 'none';
    db = emptyDb();
    synced = { contacts: new Map(), deals: new Map(), tasks: new Map() };
    dirty = false;
    closeModal();
    ui.authMode = 'login';
    ui.contactQuery = '';
    show('auth');
    renderAuth();
    if (bootMessage) { authMsg(bootMessage); bootMessage = ''; }
  }

  function boot() {
    if (!window.supabase || !CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
      $('#loading').textContent = 'Não foi possível carregar o aplicativo. Verifique sua conexão e recarregue a página.';
      return;
    }
    const params = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, ''));
    if (params.get('error') || params.get('error_code')) {
      bootMessage = 'Este link expirou ou já foi usado. Peça um novo e tente outra vez.';
      history.replaceState(null, '', location.pathname);
    }

    sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, { auth: { flowType: 'pkce' } });
    sb.auth.onAuthStateChange((event, session) => {
      // Nada de chamadas ao Supabase dentro deste aviso: adiar evita que a biblioteca trave.
      setTimeout(() => {
        if (event === 'PASSWORD_RECOVERY') {
          recovering = true;
          ui.authMode = 'recovery';
          show('auth');
          renderAuth();
        } else if (!session) {
          leave();
        } else if (!recovering) {
          enter(session);
        }
      }, 0);
    });
  }

  const contactById = (id) => db.contacts.find((c) => c.id === id);
  const dealById = (id) => db.deals.find((d) => d.id === id);
  const taskById = (id) => db.tasks.find((t) => t.id === id);
  const stageById = (id) => STAGES.find((s) => s.id === id) || STAGES[0];
  const isOpen = (deal) => OPEN_STAGES.includes(deal.stage);

  function setStage(deal, stage) {
    if (deal.stage === stage) return;
    deal.stage = stage;
    deal.closedAt = stageById(stage).closed ? isoDate() : '';
  }

  /* ------------------------------------------------------------------ */
  /* Componentes                                                         */
  /* ------------------------------------------------------------------ */

  const stageChip = (id) => {
    const s = stageById(id);
    return `<span class="chip"><i class="dot" style="background:${s.color}"></i>${esc(s.name)}</span>`;
  };

  const emptyState = (title, text, action = '') =>
    `<div class="empty"><h3>${title}</h3><p>${text}</p>${action}</div>`;

  function taskRow(t) {
    const c = contactById(t.contactId);
    const late = !t.done && t.due && t.due < isoDate();
    const meta = [t.type, c && c.name].filter(Boolean).map(esc).join(' · ');
    return `<li class="task ${t.done ? 'is-done' : ''}">
      <input type="checkbox" data-toggle-task="${esc(t.id)}" ${t.done ? 'checked' : ''} aria-label="Concluir: ${esc(t.title)}">
      <button type="button" class="task-main" data-action="edit-task" data-id="${esc(t.id)}">
        <span class="task-title">${esc(t.title)}</span>
        ${meta ? `<span class="task-meta">${meta}</span>` : ''}
      </button>
      ${t.due ? `<span class="chip ${late ? 'chip-late' : ''}">${dueLabel(t.due)}</span>` : ''}
    </li>`;
  }

  function dealRow(d) {
    const c = contactById(d.contactId);
    return `<li class="row-item" tabindex="0" role="button" data-action="edit-deal" data-id="${esc(d.id)}">
      <div class="row-main">
        <span class="row-title">${esc(d.title)}</span>
        <span class="row-meta">${c ? esc(c.name) : 'Sem contato'}</span>
      </div>
      ${stageChip(d.stage)}
      <strong class="row-value">${money(d.value)}</strong>
    </li>`;
  }

  function dealCard(d) {
    const c = contactById(d.contactId);
    const late = isOpen(d) && d.expectedClose && d.expectedClose < isoDate();
    const who = c ? esc(c.name) + (c.company ? ' · ' + esc(c.company) : '') : 'Sem contato';
    return `<article class="deal" draggable="true" tabindex="0" role="button" data-action="edit-deal" data-id="${esc(d.id)}">
      <h4>${esc(d.title)}</h4>
      <p class="deal-who">${who}</p>
      <div class="deal-foot">
        <strong>${money(d.value)}</strong>
        ${d.expectedClose && isOpen(d) ? `<span class="chip ${late ? 'chip-late' : ''}" title="Previsão de fechamento">${fmtShort(d.expectedClose)}</span>` : ''}
      </div>
    </article>`;
  }

  /* ------------------------------------------------------------------ */
  /* Telas                                                               */
  /* ------------------------------------------------------------------ */

  function viewPainel() {
    const today = isoDate();
    const month = today.slice(0, 7);
    const open = db.deals.filter(isOpen);
    const won = db.deals.filter((d) => d.stage === 'ganho');
    const lost = db.deals.filter((d) => d.stage === 'perdido');
    const wonMonth = won.filter((d) => (d.closedAt || '').startsWith(month));
    const closed = won.length + lost.length;
    const rate = closed ? Math.round((won.length / closed) * 100) + '%' : '—';
    const pending = db.tasks.filter((t) => !t.done);
    const dueNow = pending.filter((t) => t.due && t.due <= today);
    const late = pending.filter((t) => t.due && t.due < today);

    const kpi = (label, value, hint) =>
      `<div class="kpi"><span class="kpi-label">${label}</span><strong class="kpi-value">${value}</strong><span class="kpi-hint">${hint}</span></div>`;

    const perStage = OPEN_STAGES.map((id) => {
      const deals = open.filter((d) => d.stage === id);
      return { stage: stageById(id), count: deals.length, value: sumValue(deals) };
    });
    const maxValue = Math.max(1, ...perStage.map((s) => s.value));
    const funnel = perStage.map((s) => `
      <div class="funnel-row">
        <span class="funnel-name"><i class="dot" style="background:${s.stage.color}"></i>${esc(s.stage.name)}</span>
        <div class="funnel-track"><div class="funnel-bar" style="width:${s.count ? Math.max(3, (s.value / maxValue) * 100) : 0}%;background:${s.stage.color}"></div></div>
        <span class="funnel-val">${money(s.value)} <small>${s.count}</small></span>
      </div>`).join('');

    const nextTasks = pending.slice()
      .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
      .slice(0, 6);
    const topDeals = open.slice().sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 5);

    const html = `
      <div class="kpis">
        ${kpi('Funil em aberto', money(sumValue(open)), plural(open.length, 'negócio', 'negócios'))}
        ${kpi('Ganho neste mês', money(sumValue(wonMonth)), plural(wonMonth.length, 'fechamento', 'fechamentos'))}
        ${kpi('Taxa de conversão', rate, `${plural(won.length, 'ganho', 'ganhos')} · ${plural(lost.length, 'perdido', 'perdidos')}`)}
        ${kpi('Tarefas para hoje', dueNow.length, late.length ? plural(late.length, 'atrasada', 'atrasadas') : 'Nada atrasado')}
      </div>
      <div class="grid-2">
        <section class="card">
          <div class="card-head"><h2>Funil de vendas</h2><a class="link" href="#/pipeline">Abrir funil</a></div>
          ${open.length ? `<div class="funnel">${funnel}</div>` : emptyState('Nenhum negócio em aberto', 'Cadastre uma oportunidade para acompanhar aqui.')}
        </section>
        <section class="card">
          <div class="card-head"><h2>Próximas tarefas</h2><a class="link" href="#/tarefas">Ver todas</a></div>
          ${nextTasks.length ? `<ul class="tasks">${nextTasks.map(taskRow).join('')}</ul>` : emptyState('Tudo em dia', 'Você não tem tarefas pendentes.')}
        </section>
      </div>
      <section class="card">
        <div class="card-head"><h2>Maiores oportunidades em aberto</h2></div>
        ${topDeals.length ? `<ul class="rows">${topDeals.map(dealRow).join('')}</ul>` : emptyState('Sem oportunidades', 'Os negócios de maior valor aparecem aqui.')}
      </section>`;

    const isEmpty = !db.contacts.length && !db.deals.length && !db.tasks.length;
    const welcome = isEmpty ? `
      <section class="card welcome">
        <h2>Boas-vindas ao ${APP_NAME}</h2>
        <p>Sua conta está pronta. Cadastre um contato, importe uma planilha ou carregue dados de exemplo para conhecer o sistema.</p>
        <div class="setting-actions">
          <button class="btn btn-primary" data-action="new-contact">Novo contato</button>
          <button class="btn" data-action="import-contacts-csv">Importar CSV</button>
          <button class="btn" data-action="load-demo">Carregar exemplos</button>
          ${legacyData() ? `<button class="btn" data-action="import-local">Trazer dados deste navegador</button>` : ''}
        </div>
      </section>` : '';

    const sub = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    return {
      title: 'Painel',
      sub: sub.charAt(0).toUpperCase() + sub.slice(1),
      actions: `<button class="btn btn-primary" data-action="new-deal">Novo negócio</button>`,
      html: welcome + html,
    };
  }

  function viewPipeline() {
    const columns = STAGES.map((s) => {
      const deals = db.deals.filter((d) => d.stage === s.id)
        .sort((a, b) => (a.expectedClose || '9999').localeCompare(b.expectedClose || '9999'));
      return `<section class="column" data-stage="${s.id}" aria-label="${esc(s.name)}">
        <header class="column-head">
          <span class="column-name"><i class="dot" style="background:${s.color}"></i>${esc(s.name)} <small>${deals.length}</small></span>
          <span class="column-total">${money(sumValue(deals))}</span>
        </header>
        <div class="column-body">
          ${deals.map(dealCard).join('')}
          ${s.closed ? '' : `<button type="button" class="add-card" data-action="new-deal" data-stage="${s.id}">+ Adicionar</button>`}
        </div>
      </section>`;
    }).join('');

    const open = db.deals.filter(isOpen);
    return {
      title: 'Funil de vendas',
      sub: `${plural(open.length, 'negócio em aberto', 'negócios em aberto')} · ${money(sumValue(open))}`,
      actions: `<button class="btn btn-primary" data-action="new-deal">Novo negócio</button>`,
      html: `<p class="hint">Arraste os cartões entre as etapas ou clique em um cartão para editar.</p><div class="kanban">${columns}</div>`,
    };
  }

  function contactRows() {
    const q = ui.contactQuery.trim().toLowerCase();
    const list = db.contacts
      .filter((c) => !q || [c.name, c.company, c.email, c.phone, c.role].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));

    if (!list.length) {
      return `<tr><td colspan="5">${emptyState('Nenhum contato encontrado', q ? 'Tente outro termo de busca.' : 'Cadastre o primeiro contato ou importe uma planilha CSV.')}</td></tr>`;
    }
    return list.map((c) => {
      const open = db.deals.filter((d) => d.contactId === c.id && isOpen(d));
      return `<tr tabindex="0" role="button" data-action="view-contact" data-id="${esc(c.id)}">
        <td><div class="person">${avatar(c.name)}<div><span class="person-name">${esc(c.name)}</span><span class="person-sub">${esc(c.role || '')}</span></div></div></td>
        <td class="hide-sm">${esc(c.company || '—')}</td>
        <td class="hide-md">${esc(c.email || '—')}</td>
        <td class="hide-sm">${esc(c.phone || '—')}</td>
        <td class="num">${open.length ? `${money(sumValue(open))}<small>${plural(open.length, 'negócio', 'negócios')}</small>` : '<span class="muted">—</span>'}</td>
      </tr>`;
    }).join('');
  }

  function viewContatos() {
    return {
      title: 'Contatos',
      sub: plural(db.contacts.length, 'contato cadastrado', 'contatos cadastrados'),
      actions: `<button class="btn" data-action="import-contacts-csv">Importar CSV</button>
                <button class="btn btn-primary" data-action="new-contact">Novo contato</button>`,
      html: `
        <div class="toolbar">
          <input type="search" id="contact-search" class="search" placeholder="Buscar por nome, empresa, e-mail ou telefone" value="${esc(ui.contactQuery)}" aria-label="Buscar contatos">
        </div>
        <div class="card card-flush">
          <table class="table">
            <thead><tr><th>Nome</th><th class="hide-sm">Empresa</th><th class="hide-md">E-mail</th><th class="hide-sm">Telefone</th><th class="num">Em aberto</th></tr></thead>
            <tbody id="contact-rows">${contactRows()}</tbody>
          </table>
        </div>`,
    };
  }

  function viewTarefas() {
    const today = isoDate();
    const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999');
    const pending = db.tasks.filter((t) => !t.done).sort(byDue);
    const done = db.tasks.filter((t) => t.done).sort(byDue).reverse();

    const group = (title, tasks) => (tasks.length
      ? `<section class="card"><div class="card-head"><h2>${title} <small>${tasks.length}</small></h2></div><ul class="tasks">${tasks.map(taskRow).join('')}</ul></section>`
      : '');

    let body;
    if (ui.taskFilter === 'concluidas') {
      body = group('Concluídas', done) || emptyState('Nada concluído ainda', 'As tarefas marcadas como feitas aparecem aqui.');
    } else {
      body = [
        group('Atrasadas', pending.filter((t) => t.due && t.due < today)),
        group('Hoje', pending.filter((t) => t.due === today)),
        group('Próximas', pending.filter((t) => t.due && t.due > today)),
        group('Sem data', pending.filter((t) => !t.due)),
      ].join('') || emptyState('Tudo em dia', 'Você não tem tarefas pendentes.');
    }

    const tab = (id, label) =>
      `<button type="button" class="tab ${ui.taskFilter === id ? 'is-active' : ''}" data-action="task-filter" data-filter="${id}" aria-pressed="${ui.taskFilter === id}">${label}</button>`;

    return {
      title: 'Tarefas',
      sub: `${plural(pending.length, 'pendente', 'pendentes')} · ${plural(done.length, 'concluída', 'concluídas')}`,
      actions: `<button class="btn btn-primary" data-action="new-task">Nova tarefa</button>`,
      html: `<div class="toolbar"><div class="tabs">${tab('pendentes', 'Pendentes')}${tab('concluidas', 'Concluídas')}</div></div>${body}`,
    };
  }

  function viewConfig() {
    const item = (title, text, buttons) =>
      `<div class="setting"><div><h3>${title}</h3><p>${text}</p></div><div class="setting-actions">${buttons}</div></div>`;
    return {
      title: 'Dados',
      sub: `${plural(db.contacts.length, 'contato', 'contatos')} · ${plural(db.deals.length, 'negócio', 'negócios')} · ${plural(db.tasks.length, 'tarefa', 'tarefas')}`,
      html: `
        <section class="card">
          <div class="card-head"><h2>Conta</h2></div>
          ${item(esc((user && user.email) || 'Conta'), 'Seus dados ficam salvos na nuvem e só você tem acesso a eles.',
            `<button class="btn" data-action="sign-out">Sair</button>`)}
        </section>
        <section class="card">
          <div class="card-head"><h2>Planilhas</h2></div>
          ${item('Importar contatos', 'Arquivo CSV com as colunas Nome, Empresa, Cargo, E-mail e Telefone. Contatos com e-mail já cadastrado são ignorados.',
            `<button class="btn" data-action="import-contacts-csv">Importar CSV</button>`)}
          ${item('Exportar para planilha', 'Baixe contatos ou negócios em CSV, pronto para abrir no Excel ou no Google Planilhas.',
            `<button class="btn" data-action="export-contacts-csv">Contatos</button><button class="btn" data-action="export-deals-csv">Negócios</button>`)}
        </section>
        <section class="card">
          <div class="card-head"><h2>Cópia de segurança</h2></div>
          ${item('Baixar cópia completa', 'Um arquivo com todos os contatos, negócios e tarefas da sua conta, para guardar onde quiser.',
            `<button class="btn" data-action="export-json">Baixar cópia</button>`)}
          ${item('Restaurar cópia', 'Substitui todos os dados atuais pelo conteúdo de uma cópia baixada anteriormente.',
            `<button class="btn" data-action="import-json">Restaurar</button>`)}
        </section>
        <section class="card">
          <div class="card-head"><h2>Recomeçar</h2></div>
          ${item('Dados de exemplo', 'Apaga tudo e recarrega os contatos e negócios de demonstração.',
            `<button class="btn" data-action="reset-demo">Recarregar exemplos</button>`)}
          ${item('Apagar tudo', 'Remove todos os contatos, negócios e tarefas para você começar com seus próprios dados.',
            `<button class="btn btn-danger" data-action="clear-all">Apagar tudo</button>`)}
        </section>`,
    };
  }

  const VIEWS = { painel: viewPainel, pipeline: viewPipeline, contatos: viewContatos, tarefas: viewTarefas, config: viewConfig };

  function render() {
    const key = location.hash.replace(/^#\/?/, '');
    const route = VIEWS[key] ? key : 'painel';
    const board = $('.kanban');
    const scroll = board ? board.scrollLeft : 0;
    const v = VIEWS[route]();

    $('#page-title').textContent = v.title;
    $('#page-sub').textContent = v.sub || '';
    $('#page-actions').innerHTML = v.actions || '';
    $('#view').innerHTML = v.html;
    document.title = `${v.title} · ${APP_NAME}`;
    document.querySelectorAll('#nav a').forEach((a) => {
      const active = a.dataset.route === route;
      a.classList.toggle('is-active', active);
      if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });

    const today = isoDate();
    const due = db.tasks.filter((t) => !t.done && t.due && t.due <= today).length;
    const badge = $('#task-badge');
    badge.hidden = !due;
    badge.textContent = due;

    const newBoard = $('.kanban');
    if (newBoard) newBoard.scrollLeft = scroll;
  }

  /* ------------------------------------------------------------------ */
  /* Janelas (modal)                                                     */
  /* ------------------------------------------------------------------ */

  const modal = $('#modal');

  function openModal(html) {
    modal.innerHTML = html;
    if (!modal.open) modal.showModal();
    const first = modal.querySelector('[data-autofocus]');
    if (first) first.focus();
  }
  function closeModal() { if (modal.open) modal.close(); modal.innerHTML = ''; }

  const field = (label, control, cls = '') => `<label class="field ${cls}"><span>${label}</span>${control}</label>`;
  const closeBtn = `<button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">✕</button>`;

  function formModal(kind, title, body, record, deleteAction) {
    return `<form class="modal-inner" data-form="${kind}" autocomplete="off">
      <header class="modal-head"><h2>${title}</h2>${closeBtn}</header>
      <div class="modal-body form-grid">
        ${record ? `<input type="hidden" name="id" value="${esc(record.id)}">` : ''}
        ${body}
      </div>
      <footer class="modal-foot">
        ${record ? `<button type="button" class="btn btn-danger-ghost" data-action="${deleteAction}" data-id="${esc(record.id)}">Excluir</button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn" data-action="close-modal">Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar</button>
      </footer>
    </form>`;
  }

  function contactOptions(selected) {
    const list = db.contacts.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
    return `<option value="">— Sem contato —</option>` + list.map((c) =>
      `<option value="${esc(c.id)}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}${c.company ? ' · ' + esc(c.company) : ''}</option>`).join('');
  }

  function openContactForm(c) {
    const v = c || {};
    openModal(formModal('contact', c ? 'Editar contato' : 'Novo contato', `
      ${field('Nome', `<input name="name" required maxlength="120" value="${esc(v.name)}" data-autofocus>`, 'span-2')}
      ${field('Empresa', `<input name="company" maxlength="120" value="${esc(v.company)}">`)}
      ${field('Cargo', `<input name="role" maxlength="80" value="${esc(v.role)}">`)}
      ${field('E-mail', `<input name="email" type="email" maxlength="160" value="${esc(v.email)}">`)}
      ${field('Telefone / WhatsApp', `<input name="phone" type="tel" maxlength="30" placeholder="(11) 99999-0000" value="${esc(v.phone)}">`)}
      ${field('Observações', `<textarea name="notes" rows="3" maxlength="2000">${esc(v.notes)}</textarea>`, 'span-2')}
    `, c, 'delete-contact'));
  }

  function openDealForm(d, preset = {}) {
    const v = d || { stage: preset.stage || 'lead', contactId: preset.contactId || '' };
    const stages = STAGES.map((s) => `<option value="${s.id}" ${s.id === v.stage ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
    openModal(formModal('deal', d ? 'Editar negócio' : 'Novo negócio', `
      ${field('Título', `<input name="title" required maxlength="140" placeholder="Ex.: Plano anual — Empresa X" value="${esc(v.title)}" data-autofocus>`, 'span-2')}
      ${field('Contato', `<select name="contactId">${contactOptions(v.contactId)}</select>`, 'span-2')}
      ${field('Valor (R$)', `<input name="value" inputmode="decimal" placeholder="0,00" value="${v.value ? esc(String(v.value).replace('.', ',')) : ''}">`)}
      ${field('Etapa', `<select name="stage">${stages}</select>`)}
      ${field('Previsão de fechamento', `<input name="expectedClose" type="date" value="${esc(v.expectedClose)}">`, 'span-2')}
      ${field('Observações', `<textarea name="notes" rows="3" maxlength="2000">${esc(v.notes)}</textarea>`, 'span-2')}
    `, d, 'delete-deal'));
  }

  function openTaskForm(t, preset = {}) {
    const v = t || { type: 'Follow-up', due: isoDate(), contactId: preset.contactId || '' };
    const types = TASK_TYPES.map((x) => `<option ${x === v.type ? 'selected' : ''}>${esc(x)}</option>`).join('');
    openModal(formModal('task', t ? 'Editar tarefa' : 'Nova tarefa', `
      ${field('O que precisa ser feito?', `<input name="title" required maxlength="140" value="${esc(v.title)}" data-autofocus>`, 'span-2')}
      ${field('Tipo', `<select name="type">${types}</select>`)}
      ${field('Data', `<input name="due" type="date" value="${esc(v.due)}">`)}
      ${field('Contato', `<select name="contactId">${contactOptions(v.contactId)}</select>`, 'span-2')}
      ${t ? `<label class="check span-2"><input type="checkbox" name="done" ${v.done ? 'checked' : ''}> Tarefa concluída</label>` : ''}
    `, t, 'delete-task'));
  }

  function openContactDetail(id) {
    const c = contactById(id);
    if (!c) return;
    const deals = db.deals.filter((d) => d.contactId === id);
    const tasks = db.tasks.filter((t) => t.contactId === id).sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '9999').localeCompare(b.due || '9999'));
    const wa = waLink(c.phone);
    const phoneDigits = String(c.phone || '').replace(/[^\d+]/g, '');
    const quick = [
      wa && `<a class="btn" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`,
      c.email && `<a class="btn" href="mailto:${esc(encodeURIComponent(c.email).replace(/%40/g, '@'))}">E-mail</a>`,
      phoneDigits && `<a class="btn" href="tel:${esc(phoneDigits)}">Ligar</a>`,
    ].filter(Boolean).join('');
    const sub = [c.role, c.company].filter(Boolean).map(esc).join(' · ');

    openModal(`<div class="modal-inner">
      <header class="modal-head">
        <div class="person">${avatar(c.name, 'avatar-lg')}<div><h2>${esc(c.name)}</h2>${sub ? `<p class="muted">${sub}</p>` : ''}</div></div>
        ${closeBtn}
      </header>
      <div class="modal-body">
        ${quick ? `<div class="quick">${quick}</div>` : ''}
        <dl class="facts">
          ${c.email ? `<div><dt>E-mail</dt><dd>${esc(c.email)}</dd></div>` : ''}
          ${c.phone ? `<div><dt>Telefone</dt><dd>${esc(c.phone)}</dd></div>` : ''}
          ${c.notes ? `<div class="span-2"><dt>Observações</dt><dd class="pre">${esc(c.notes)}</dd></div>` : ''}
        </dl>
        <div class="card-head"><h3>Negócios <small>${deals.length}</small></h3><button type="button" class="link" data-action="new-deal" data-contact="${esc(c.id)}">+ Novo negócio</button></div>
        ${deals.length ? `<ul class="rows">${deals.map(dealRow).join('')}</ul>` : `<p class="muted small">Nenhum negócio com este contato.</p>`}
        <div class="card-head"><h3>Tarefas <small>${tasks.length}</small></h3><button type="button" class="link" data-action="new-task" data-contact="${esc(c.id)}">+ Nova tarefa</button></div>
        ${tasks.length ? `<ul class="tasks">${tasks.map(taskRow).join('')}</ul>` : `<p class="muted small">Nenhuma tarefa com este contato.</p>`}
      </div>
      <footer class="modal-foot">
        <button type="button" class="btn btn-danger-ghost" data-action="delete-contact" data-id="${esc(c.id)}">Excluir</button>
        <span class="spacer"></span>
        <button type="button" class="btn" data-action="close-modal">Fechar</button>
        <button type="button" class="btn btn-primary" data-action="edit-contact" data-id="${esc(c.id)}">Editar</button>
      </footer>
    </div>`);
  }

  /* ------------------------------------------------------------------ */
  /* Salvar e excluir                                                    */
  /* ------------------------------------------------------------------ */

  function commit(message) {
    save();
    closeModal();
    render();
    if (message) toast(message);
  }

  const FORMS = {
    contact(f) {
      const data = {
        name: f.name.trim(), company: f.company.trim(), role: f.role.trim(),
        email: f.email.trim(), phone: f.phone.trim(), notes: f.notes.trim(),
      };
      if (!data.name) return;
      const existing = f.id && contactById(f.id);
      if (existing) Object.assign(existing, data);
      else db.contacts.push({ id: uid(), createdAt: isoDate(), ...data });
      commit(existing ? 'Contato atualizado.' : 'Contato criado.');
    },
    deal(f) {
      const title = f.title.trim();
      if (!title) return;
      const data = { title, contactId: f.contactId, value: parseMoney(f.value), expectedClose: f.expectedClose, notes: f.notes.trim() };
      const existing = f.id && dealById(f.id);
      if (existing) {
        Object.assign(existing, data);
        setStage(existing, f.stage);
      } else {
        const deal = { id: uid(), createdAt: isoDate(), stage: '', closedAt: '', ...data };
        setStage(deal, f.stage);
        db.deals.push(deal);
      }
      commit(existing ? 'Negócio atualizado.' : 'Negócio criado.');
    },
    task(f) {
      const title = f.title.trim();
      if (!title) return;
      const data = { title, type: f.type, due: f.due, contactId: f.contactId };
      const existing = f.id && taskById(f.id);
      if (existing) Object.assign(existing, data, { done: f.done === 'on' });
      else db.tasks.push({ id: uid(), done: false, ...data });
      commit(existing ? 'Tarefa atualizada.' : 'Tarefa criada.');
    },
    async auth(f, form) {
      const mode = ui.authMode;
      const button = form.querySelector('[type="submit"]');
      const email = (f.email || '').trim();
      if (email) ui.authEmail = email;
      button.disabled = true;
      authMsg('');
      try {
        if (mode === 'login') {
          const { error } = await sb.auth.signInWithPassword({ email, password: f.password });
          if (error) throw error;
        } else if (mode === 'signup') {
          const { data, error } = await sb.auth.signUp({ email, password: f.password, options: { emailRedirectTo: APP_URL } });
          if (error) throw error;
          if (!data.session) {
            ui.authMode = 'login';
            renderAuth();
            authMsg(`Enviamos um link de confirmação para ${email}. Abra o e-mail, confirme e depois entre com sua senha.`, true);
          }
        } else if (mode === 'forgot') {
          const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: APP_URL });
          if (error) throw error;
          authMsg('Se existir uma conta com este e-mail, o link de recuperação chega em instantes.', true);
        } else {
          const { error } = await sb.auth.updateUser({ password: f.password });
          if (error) throw error;
          recovering = false;
          ui.authMode = 'login';
          const { data } = await sb.auth.getSession();
          if (data.session) await enter(data.session); else leave();
          toast('Senha atualizada.');
        }
      } catch (err) {
        authMsg(authError(err));
      } finally {
        if (button.isConnected) button.disabled = false;
      }
    },
  };

  /** Pede um segundo clique antes de uma ação destrutiva. */
  function confirmed(btn) {
    if (btn.dataset.armed) return true;
    const label = btn.textContent;
    btn.dataset.armed = '1';
    btn.textContent = 'Clique de novo para confirmar';
    setTimeout(() => {
      if (!btn.isConnected) return;
      delete btn.dataset.armed;
      btn.textContent = label;
    }, 4000);
    return false;
  }

  /* ------------------------------------------------------------------ */
  /* Importar e exportar                                                 */
  /* ------------------------------------------------------------------ */

  function download(filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function csvCell(value) {
    let s = String(value ?? '');
    // Evita que a planilha interprete o texto como fórmula.
    if (/^[=+\-@]/.test(s) && !/^[+-]?[\d\s().,-]+$/.test(s)) s = "'" + s;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const toCSV = (rows) => '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');

  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/, 1)[0] || '';
    const delim = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
    const rows = [];
    let row = [], cur = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else quoted = false; }
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch !== '\r') cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
  }

  function pickFile(accept, handler) {
    const input = $('#file-input');
    input.value = '';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => handler(String(reader.result || ''));
      reader.onerror = () => toast('Não foi possível ler o arquivo.');
      reader.readAsText(file);
    };
    input.click();
  }

  const HEADER_MAP = {
    nome: 'name', name: 'name', contato: 'name',
    empresa: 'company', company: 'company',
    cargo: 'role', role: 'role', funcao: 'role',
    email: 'email', 'e-mail': 'email',
    telefone: 'phone', phone: 'phone', celular: 'phone', whatsapp: 'phone', fone: 'phone',
    observacoes: 'notes', notas: 'notes', notes: 'notes',
  };

  function importContacts(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) return toast('O arquivo não tem contatos para importar.');
    const keys = rows[0].map((h) => HEADER_MAP[h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')] || null);
    if (!keys.includes('name')) return toast('Não encontrei uma coluna "Nome" no arquivo.');

    const emails = new Set(db.contacts.map((c) => String(c.email || '').toLowerCase()).filter(Boolean));
    let added = 0, skipped = 0;
    for (const row of rows.slice(1)) {
      const c = { id: uid(), name: '', company: '', role: '', email: '', phone: '', notes: '', createdAt: isoDate() };
      keys.forEach((k, i) => { if (k && row[i] != null) c[k] = row[i].trim().slice(0, 2000); });
      const email = c.email.toLowerCase();
      if (!c.name || (email && emails.has(email))) { skipped++; continue; }
      if (email) emails.add(email);
      db.contacts.push(c);
      added++;
    }
    save();
    render();
    toast(`${plural(added, 'contato importado', 'contatos importados')}${skipped ? ` · ${plural(skipped, 'ignorado', 'ignorados')}` : ''}.`);
  }

  function importBackup(text) {
    let data;
    try { data = JSON.parse(text); } catch (err) { return toast('Este arquivo não é uma cópia válida.'); }
    if (!data || !Array.isArray(data.contacts) || !Array.isArray(data.deals) || !Array.isArray(data.tasks)) {
      return toast('Este arquivo não é uma cópia válida.');
    }
    db = reId(normalize(data));
    save();
    render();
    toast('Cópia restaurada.');
  }

  /* ------------------------------------------------------------------ */
  /* Ações                                                               */
  /* ------------------------------------------------------------------ */

  const ACTIONS = {
    'close-modal': () => closeModal(),

    'new-contact': () => openContactForm(),
    'view-contact': (el) => openContactDetail(el.dataset.id),
    'edit-contact': (el) => openContactForm(contactById(el.dataset.id)),
    'delete-contact': (el) => {
      if (!confirmed(el)) return;
      const id = el.dataset.id;
      db.contacts = db.contacts.filter((c) => c.id !== id);
      db.deals.forEach((d) => { if (d.contactId === id) d.contactId = ''; });
      db.tasks.forEach((t) => { if (t.contactId === id) t.contactId = ''; });
      commit('Contato excluído.');
    },

    'new-deal': (el) => openDealForm(null, { contactId: el.dataset.contact, stage: el.dataset.stage }),
    'edit-deal': (el) => { const d = dealById(el.dataset.id); if (d) openDealForm(d); },
    'delete-deal': (el) => {
      if (!confirmed(el)) return;
      db.deals = db.deals.filter((d) => d.id !== el.dataset.id);
      commit('Negócio excluído.');
    },

    'new-task': (el) => openTaskForm(null, { contactId: el.dataset.contact }),
    'edit-task': (el) => { const t = taskById(el.dataset.id); if (t) openTaskForm(t); },
    'delete-task': (el) => {
      if (!confirmed(el)) return;
      db.tasks = db.tasks.filter((t) => t.id !== el.dataset.id);
      commit('Tarefa excluída.');
    },
    'task-filter': (el) => { ui.taskFilter = el.dataset.filter; render(); },

    'import-contacts-csv': () => pickFile('.csv,text/csv', importContacts),
    'export-contacts-csv': () => {
      const rows = [['Nome', 'Empresa', 'Cargo', 'E-mail', 'Telefone', 'Observações']]
        .concat(db.contacts.map((c) => [c.name, c.company, c.role, c.email, c.phone, c.notes]));
      download(`contatos-${isoDate()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
    },
    'export-deals-csv': () => {
      const rows = [['Título', 'Contato', 'Empresa', 'Valor', 'Etapa', 'Previsão', 'Fechado em']]
        .concat(db.deals.map((d) => {
          const c = contactById(d.contactId) || {};
          return [d.title, c.name, c.company, String(d.value || 0).replace('.', ','), stageById(d.stage).name, fmtDate(d.expectedClose), fmtDate(d.closedAt)];
        }));
      download(`negocios-${isoDate()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
    },
    'export-json': () => download(`pulso-crm-copia-${isoDate()}.json`, JSON.stringify(db, null, 2), 'application/json'),
    'import-json': (el) => { if (confirmed(el)) pickFile('.json,application/json', importBackup); },
    'reset-demo': (el) => { if (!confirmed(el)) return; db = seed(); commit('Dados de exemplo recarregados.'); },
    'clear-all': (el) => { if (!confirmed(el)) return; db = emptyDb(); commit('Todos os dados foram apagados.'); },
    'load-demo': () => { db = seed(); commit('Dados de exemplo carregados.'); },
    'import-local': () => {
      const local = legacyData();
      if (!local) return;
      db = reId(local);
      commit('Dados deste navegador trazidos para a sua conta.');
    },

    'auth-mode': (el) => {
      const email = $('#auth [name="email"]');
      if (email) ui.authEmail = email.value.trim();
      ui.authMode = el.dataset.mode;
      renderAuth();
    },
    'sign-out': async (el) => {
      el.disabled = true;
      try {
        await syncChain;
        if (dirty) {
          try { await pushChanges(); dirty = false; } catch (err) { /* tratado logo abaixo */ }
        }
        if (dirty && !el.dataset.force) {
          el.dataset.force = '1';
          toast('Há alterações que não foram salvas na nuvem. Clique em Sair de novo para sair mesmo assim.');
          return;
        }
        delete el.dataset.force;
        await sb.auth.signOut({ scope: 'local' });
      } finally {
        el.disabled = false;
      }
    },
  };

  /* ------------------------------------------------------------------ */
  /* Eventos                                                             */
  /* ------------------------------------------------------------------ */

  document.addEventListener('click', (e) => {
    if (e.target === modal) return closeModal();
    const el = elementOf(e);
    const trigger = el && el.closest('[data-action]');
    if (!trigger) return;
    const action = ACTIONS[trigger.dataset.action];
    if (action) action(trigger);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = elementOf(e);
    if (el && el.matches('[role="button"][data-action]')) { e.preventDefault(); el.click(); }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    FORMS[form.dataset.form](Object.fromEntries(new FormData(form)), form);
  });

  document.addEventListener('change', (e) => {
    const el = elementOf(e);
    if (!el || !el.dataset.toggleTask) return;
    const task = taskById(el.dataset.toggleTask);
    if (!task) return;
    task.done = el.checked;
    save();
    const contactOpen = modal.open && modal.querySelector('[data-action="edit-contact"]');
    render();
    if (contactOpen) openContactDetail(contactOpen.dataset.id);
  });

  document.addEventListener('input', (e) => {
    if (e.target.id !== 'contact-search') return;
    ui.contactQuery = e.target.value;
    $('#contact-rows').innerHTML = contactRows();
  });

  modal.addEventListener('close', () => { modal.innerHTML = ''; });

  // Arrastar e soltar no funil
  let dragId = null;
  const clearDrop = () => document.querySelectorAll('.column.is-over').forEach((c) => c.classList.remove('is-over'));

  document.addEventListener('dragstart', (e) => {
    const card = elementOf(e) && elementOf(e).closest('.deal');
    if (!card) return;
    dragId = card.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
    card.classList.add('is-dragging');
  });
  document.addEventListener('dragover', (e) => {
    const col = dragId && elementOf(e) && elementOf(e).closest('.column');
    if (!col) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!col.classList.contains('is-over')) { clearDrop(); col.classList.add('is-over'); }
  });
  document.addEventListener('drop', (e) => {
    const col = dragId && elementOf(e) && elementOf(e).closest('.column');
    if (!col) return;
    e.preventDefault();
    const deal = dealById(dragId);
    dragId = null;
    if (!deal || deal.stage === col.dataset.stage) return clearDrop();
    setStage(deal, col.dataset.stage);
    save();
    render();
    toast(`Movido para ${stageById(deal.stage).name}.`);
  });
  document.addEventListener('dragend', () => {
    dragId = null;
    clearDrop();
    document.querySelectorAll('.deal.is-dragging').forEach((c) => c.classList.remove('is-dragging'));
  });

  /* ------------------------------------------------------------------ */
  /* Aviso rápido                                                        */
  /* ------------------------------------------------------------------ */

  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2800);
  }

  /* ------------------------------------------------------------------ */
  /* Início                                                              */
  /* ------------------------------------------------------------------ */

  window.addEventListener('hashchange', () => {
    if ($('.app').hidden) return;
    closeModal();
    render();
  });

  // Ao voltar para a aba, busca o que mudou em outros aparelhos (se não houver nada em andamento aqui).
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || loadState !== 'ready' || pending || dirty || modal.open) return;
    if (Date.now() - loadedAt < 60000) return;
    const before = version;
    const owner = user.id;
    try {
      const rows = await fetchData();
      if (version !== before || pending || dirty || modal.open || !user || user.id !== owner) return;
      applyData(rows);
      render();
    } catch (err) { /* mantém o que já está na tela */ }
  });

  window.addEventListener('online', () => { if (dirty) save(); });
  window.addEventListener('beforeunload', (e) => {
    if (!pending && !dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  boot();
})();
