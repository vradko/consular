import './style.css';
import {
  subscribe, getState, FIELDS, SCREENS, VISA_CATEGORIES, MRV_FEE_USD,
  setField, goToScreen, undoLastBatch, clearRecent, attachDocument, setDocumentText,
  addDocument, removeDocument, loadSampleDocuments, clearDocuments, logActivity, runRules, missingRequired
} from './state.js';
import { registerTools, isWebMcpAvailable, ACTION_POLICY } from './agent/tools.js';

const $ = (id) => document.getElementById(id);
const form = $('application-form');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ── field controls ──────────────────────────────────────────────────
function control(name, spec, value, recent) {
  const id = `f-${name}`, cls = recent ? ' recent' : '';
  if (spec.type === 'enum') {
    return `<select id="${id}" data-field="${name}" class="ctl${cls}"><option value="">Select…</option>${spec.options
      .map((o) => `<option value="${esc(o)}"${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  }
  if (spec.type === 'yesno') {
    return `<div class="yesno${cls}" role="radiogroup">${['Yes', 'No'].map((o) =>
      `<label><input type="radio" name="${name}" value="${o}" data-field="${name}"${value === o ? ' checked' : ''}> ${o}</label>`).join('')}</div>`;
  }
  if (spec.type === 'text') return `<textarea id="${id}" data-field="${name}" rows="2" class="ctl${cls}">${esc(value)}</textarea>`;
  const type = { number: 'number', date: 'date', email: 'email' }[spec.type] || 'text';
  return `<input id="${id}" data-field="${name}" type="${type}" value="${esc(value)}" class="ctl${cls}" />`;
}

function srcChip(recent) {
  return recent ? `<span class="src-chip" title="Written by your agent">${recent.source ? 'from ' + esc(recent.source) : 'agent'}</span>` : '';
}

function fieldRow(name, spec, state) {
  const recent = state.recent[name];
  return `<div class="row${spec.humanOnly ? ' human-only' : ''}" data-row="${name}">
    <label class="row-label" for="f-${name}">
      <span class="row-n">${spec.n}</span>
      <span class="row-text">${esc(spec.label)}${spec.optional ? ' <em>(optional)</em>' : ''}${srcChip(recent)}</span>
      ${spec.humanOnly ? '<span class="row-flag">answer personally</span>' : ''}
      ${spec.hint ? `<span class="row-hint">${esc(spec.hint)}</span>` : ''}
    </label>
    <div class="row-ctl">${control(name, spec, state.fields[name], recent)}</div>
  </div>`;
}

// ── screens ─────────────────────────────────────────────────────────
function screenHeader(screen, sub) {
  return `<header class="sheet-head"><p class="sheet-part">Part ${screen.part} of ${SCREENS.length}</p><h2>${esc(screen.title)}</h2>${sub ? `<p class="sheet-sub">${sub}</p>` : ''}</header>`;
}

function renderCategory(state, screen) {
  const chosen = state.fields.visaCategory, recent = state.recent.visaCategory;
  return `${screenHeader(screen, 'Choose the category that matches the purpose of your trip. Getting this wrong is the most common reason an application is returned. Unsure? Describe your trip to your agent.')}
    ${recent ? `<p class="muted small">Category chosen by your agent${recent.source ? ` from ${esc(recent.source)}` : ''}. Pick another card to overrule it.</p>` : ''}
    <div class="cats">${VISA_CATEGORIES.map((c) => `
      <label class="cat${chosen === c.code ? ' chosen' : ''}${recent && chosen === c.code ? ' recent' : ''}">
        <input type="radio" name="visaCategory" value="${c.code}" data-field="visaCategory"${chosen === c.code ? ' checked' : ''}>
        <span class="cat-code">${c.code}</span>
        <span class="cat-name">${esc(c.name)}</span>
        <span class="cat-sum">${esc(c.summary)}</span>
        ${c.prerequisite ? `<span class="cat-req">Requires ${esc(c.prerequisite)}</span>` : ''}
      </label>`).join('')}
    </div>
    <div class="rows">${fieldRow('petitionNumber', FIELDS.petitionNumber, state)}</div>`;
}

function renderDocuments(state, screen) {
  const docs = state.documents.filter((d) => !d.editable);
  return `${screenHeader(screen, 'Attach the documents that support this application. Your agent can read them and attach the right ones.')}
    ${docs.length ? `<ul class="doc-attach">${docs.map((d) => `
      <li class="${d.attached ? 'on' : ''}">
        <label><input type="checkbox" data-doc="${d.id}"${d.attached ? ' checked' : ''}> <strong>${esc(d.kind)}</strong></label>
        <span class="doc-state">${d.attached ? 'attached' : 'not attached'}</span>
      </li>`).join('')}</ul>` : '<p class="docs-empty">No documents yet. Add them in the Your documents panel, or load the sample applicant.</p>'}`;
}

function renderReview(state, screen) {
  const problems = runRules(), missing = missingRequired();
  const groups = SCREENS.filter((s) => !['review', 'documents', 'category'].includes(s.id)).map((s) => `
    <section class="rev-group"><h3>Part ${s.part} · ${esc(s.title)}</h3><dl>${Object.entries(FIELDS).filter(([, sp]) => sp.screen === s.id).map(([n, sp]) => {
      const v = state.fields[n];
      return `<div class="rev-row${v ? '' : (sp.optional ? ' opt' : ' empty')}"><dt>${sp.n} ${esc(sp.label)}</dt><dd>${v ? esc(v) : (sp.optional ? '—' : 'not answered')}</dd></div>`;
    }).join('')}</dl></section>`).join('');
  const cat = VISA_CATEGORIES.find((c) => c.code === state.fields.visaCategory);
  return `${screenHeader(screen, 'Nothing below is sent until you approve it in a dialog.')}
    <section class="rev-group"><h3>Part 1 · Visa category</h3><p class="rev-cat">${cat ? `<strong>${cat.code}</strong> ${esc(cat.name)}` : '<span class="empty">not chosen</span>'}</p></section>
    ${groups}
    <section class="rev-checks">
      <h3>Consular checks</h3>
      ${problems.length === 0 && missing.length === 0
        ? '<p class="check ok">All checks pass.</p>'
        : `<ul class="checks">${problems.map((p) => `<li class="check ${p.severity === 'error' ? 'bad' : 'warn'}"><strong>${esc(p.id)} ${esc(p.title)}${p.severity === 'warning' ? ' · advisory' : ''}</strong><span>${esc(p.finding)}</span></li>`).join('')}
           ${missing.length ? `<li class="check warn"><strong>Required fields empty</strong><span>${missing.map((m) => m.n).join(', ')}</span></li>` : ''}</ul>`}
    </section>
    <section class="rev-final">
      <div class="final-item${state.fee ? ' done' : ''}"><span class="final-k">Application fee</span><span class="final-v">${state.fee ? `Paid · ${state.fee.reference}` : `US$${MRV_FEE_USD} · not paid`}</span></div>
      <div class="final-item${state.interview ? ' done' : ''}"><span class="final-k">Interview</span><span class="final-v">${state.interview ? `${state.interview.date} ${state.interview.time} · ${esc(state.interview.location)}` : 'not scheduled'}</span></div>
      <div class="final-item${state.submission ? ' done' : ''}"><span class="final-k">Submission</span><span class="final-v">${state.submission ? `Filed · ${state.submission.reference}` : 'not filed'}</span></div>
    </section>
    ${state.submission ? '' : '<p class="muted small">Paying, scheduling and filing are done by your agent on your instruction — each one opens a confirmation you must approve.</p>'}`;
}

function renderForm(state) {
  const screen = SCREENS.find((s) => s.id === state.screen);
  let body;
  if (screen.id === 'category') body = renderCategory(state, screen);
  else if (screen.id === 'documents') body = renderDocuments(state, screen);
  else if (screen.id === 'review') body = renderReview(state, screen);
  else {
    const sub = screen.id === 'security'
      ? 'These are legal declarations. Your agent can explain each question but will not answer them for you.'
      : screen.id === 'personal' ? 'Names must be written exactly as they appear in the machine-readable zone of your passport.' : '';
    body = `${screenHeader(screen, sub)}<div class="rows">${Object.entries(FIELDS).filter(([, sp]) => sp.screen === screen.id).map(([n, sp]) => fieldRow(n, sp, state)).join('')}</div>`;
  }
  const i = SCREENS.findIndex((s) => s.id === screen.id);
  const prev = SCREENS[i - 1], next = SCREENS[i + 1];
  form.innerHTML = `${body}<footer class="sheet-nav">
    ${prev ? `<button type="button" class="btn btn-ghost" data-nav="${prev.id}">‹ Part ${prev.part}</button>` : '<span></span>'}
    ${next ? `<button type="button" class="btn btn-primary" data-nav="${next.id}">Part ${next.part}: ${esc(next.title)} ›</button>` : ''}
  </footer>`;
}

function renderParts(state) {
  $('parts').innerHTML = SCREENS.map((s) => {
    const fields = Object.entries(FIELDS).filter(([, sp]) => sp.screen === s.id && !sp.optional);
    const done = fields.length > 0 && fields.every(([n]) => String(state.fields[n] || '').trim());
    return `<button type="button" class="part${s.id === state.screen ? ' active' : ''}${done ? ' done' : ''}" data-screen="${s.id}" title="${esc(s.title)}">
      <span class="part-n">${s.part}</span><span class="part-t">${esc(s.title)}</span></button>`;
  }).join('');
}

// ── side panels ─────────────────────────────────────────────────────
function renderChanges(state) {
  const b = state.lastBatch;
  $('changes-card').hidden = !b;
  if (!b) return;
  $('changes-when').textContent = b.at;
  $('changes-note').textContent = b.note || `${b.changes.length} field(s) written from your documents.`;
  $('changes-diff').innerHTML = b.changes.map((c) => `<li>
    <span class="d-field">${FIELDS[c.field].n} ${esc(FIELDS[c.field].label)}</span>
    <span class="d-vals">${c.from ? `<s>${esc(c.from)}</s> ` : ''}<b>${esc(c.to)}</b></span>
    ${c.source ? `<span class="d-src">from ${esc(c.source)}</span>` : ''}
  </li>`).join('');
}

function renderPolicy() {
  $('policy-list').innerHTML = ACTION_POLICY.consequential.map((c) => `<li><code>${esc(c.tool)}</code><span>${esc(c.why)}</span></li>`).join('')
    + `<li class="policy-human"><code>Part 7</code><span>${esc(ACTION_POLICY.humanOnly.why)}</span></li>`;
}

function renderDocs(state) {
  const attachable = state.documents.filter((d) => !d.editable);
  $('docs-count').textContent = attachable.length ? `${attachable.filter((d) => d.attached).length} of ${attachable.length} attached` : 'none yet';
  $('docs-sample').hidden = state.sampleLoaded;
  $('docs-clear').hidden = attachable.length === 0;
  if (document.activeElement?.dataset?.notes) return; // don't re-render under the caret
  $('docs-list').innerHTML = (attachable.length ? '' : '<li class="docs-empty">Nothing here yet. Add your own files, paste text, or load the sample applicant.</li>')
    + state.documents.map((d, i) => `<li class="doc${d.attached ? ' attached' : ''}${d.editable ? ' editable' : ''}${d.own ? ' own' : ''}">
    <details${d.editable || i === 0 ? ' open' : ''}><summary>
      <span class="doc-kind">${esc(d.kind)}${d.own ? '<span class="doc-own-tag">yours</span>' : ''}</span>
      <span class="doc-preview">${esc(d.text.split('\n')[0].slice(0, 48))}${d.text.length > 48 ? '…' : ''}</span>
      <span class="doc-att">${d.attached ? 'attached' : ''}</span>
      ${d.editable ? '' : `<button type="button" class="doc-remove" data-remove="${d.id}" title="Remove this document" aria-label="Remove ${esc(d.kind)}">×</button>`}</summary>
    ${d.editable ? `<textarea data-notes="${d.id}" rows="5" placeholder="Anything no document contains: your phone, email, who pays for the trip, US contact…">${esc(d.text)}</textarea>` : `<pre>${esc(d.text)}</pre>`}</details>
  </li>`).join('');
}

function renderActivity(state) {
  $('activity').innerHTML = state.activity.length
    ? state.activity.map((a) => `<li class="act act-${a.kind}"><span>${esc(a.text)}</span><time>${a.at}</time></li>`).join('')
    : '<li class="muted small">Nothing yet.</li>';
}

function renderStrip(state) {
  const own = state.documents.filter((d) => !d.editable && d.own).length;
  const panelHidden = $('layout').classList.contains('panel-hidden');
  const where = panelHidden ? '<a href="#" data-show-panel>show the demo panel</a> to see them' : 'in <a href="#docs-card">Your documents</a>';
  let text;
  if (state.sampleLoaded) text = `<strong>Sample applicant loaded.</strong> Maria Kovalenko, a conference speaker, with her five documents ${where} — nothing to upload. Or replace them with your own.`;
  else if (own) text = `<strong>${own} of your own document${own === 1 ? '' : 's'} loaded</strong> ${where}. Ask your agent to fill in the application from them.`;
  else text = `<strong>No documents loaded.</strong> Add your own or load the sample applicant ${where}.`;
  $('sample-strip').innerHTML = text;
}

subscribe((state) => { renderParts(state); renderForm(state); renderChanges(state); renderDocs(state); renderActivity(state); renderStrip(state); });
renderPolicy();

// ── demo panel toggle ───────────────────────────────────────────────
function setPanel(shown) {
  $('layout').classList.toggle('panel-hidden', !shown);
  const b = $('panel-toggle');
  b.textContent = shown ? 'Hide demo panel' : 'Show demo panel';
  b.setAttribute('aria-pressed', String(shown));
  try { localStorage.setItem('consular.panel', shown ? '1' : '0'); } catch {}
  renderStrip(getState());
}
$('panel-toggle').onclick = () => setPanel($('layout').classList.contains('panel-hidden'));
document.addEventListener('click', (e) => { if (e.target.closest('[data-show-panel]')) { e.preventDefault(); setPanel(true); $('docs-card').scrollIntoView({ behavior: 'smooth' }); } });
try { if (localStorage.getItem('consular.panel') === '0') setPanel(false); } catch {}

// ── events ──────────────────────────────────────────────────────────
$('parts').addEventListener('click', (e) => { const b = e.target.closest('[data-screen]'); if (b) goToScreen(b.dataset.screen); });
form.addEventListener('click', (e) => { const b = e.target.closest('[data-nav]'); if (b) goToScreen(b.dataset.nav); });
form.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset?.field) {
    // never re-render the sheet from its own input event — that would detach
    // the control under the user's hand. Native controls already show their
    // state; only the category cards and the parts strip need a nudge.
    const field = t.dataset.field;
    setField(field, t.value, { silent: true });
    clearRecent(field, { silent: true });
    const row = t.closest('[data-row]');
    row?.querySelector('.src-chip')?.remove();
    row?.querySelector('.recent')?.classList.remove('recent');
    if (field === 'visaCategory') {
      form.querySelectorAll('.cat').forEach((c) => { c.classList.toggle('chosen', c.querySelector('input').value === t.value); c.classList.remove('recent'); });
    }
    renderParts(getState());
  }
  if (t.dataset?.doc) attachDocument(t.dataset.doc, t.checked);
});
$('undo-batch').onclick = () => logActivity('discarded', `Undid ${undoLastBatch()} change(s) by the agent`);

// ── documents: own files, pasted text, the sample ──────────────────
$('docs-list').addEventListener('input', (e) => { if (e.target.dataset?.notes) setDocumentText(e.target.dataset.notes, e.target.value); });
$('docs-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-remove]');
  if (!b) return;
  e.preventDefault();
  const doc = getState().documents.find((d) => d.id === b.dataset.remove);
  if (removeDocument(b.dataset.remove)) logActivity('discarded', `Removed ${doc?.kind || 'a document'}`);
});
$('docs-sample').onclick = () => { loadSampleDocuments(); logActivity('ready', 'Loaded the sample applicant (Maria Kovalenko, five documents)'); };
$('docs-clear').onclick = () => { clearDocuments(); logActivity('discarded', 'Removed all documents'); };
$('doc-paste-toggle').onclick = () => { const f = $('paste-form'); f.hidden = !f.hidden; if (!f.hidden) $('paste-kind').focus(); };
$('paste-cancel').onclick = () => { $('paste-form').hidden = true; };
$('paste-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('paste-text').value.trim();
  if (!text) return;
  const kind = $('paste-kind').value.trim() || text.split('\n')[0].slice(0, 40);
  addDocument({ kind, text });
  logActivity('ready', `Added "${kind}" from pasted text`);
  $('paste-kind').value = ''; $('paste-text').value = ''; $('paste-form').hidden = true;
});

async function readFile(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      text += content.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('') + '\n';
    }
    return text.replace(/[ \t]+\n/g, '\n').trim();
  }
  return (await file.text()).trim();
}

async function addFiles(files) {
  for (const file of files) {
    const kind = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    try {
      const text = await readFile(file);
      if (!text) { logActivity('blocked', `"${file.name}" has no readable text — a scan? Paste the text instead.`); continue; }
      addDocument({ kind, text });
      logActivity('ready', `Added "${kind}" (${Math.round(text.length / 100) / 10}k characters)`);
    } catch (error) {
      logActivity('blocked', `Couldn't read "${file.name}": ${error.message}`);
    }
  }
}
$('doc-files').addEventListener('change', (e) => { addFiles([...e.target.files]); e.target.value = ''; });
const dropZone = $('docs-card');
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drop-hover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-hover'));
dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('drop-hover'); addFiles([...e.dataTransfer.files]); });

// ── agent ───────────────────────────────────────────────────────────
window.__consularState = getState;
window.__consularValidate = runRules;
(async () => {
  const el = $('agent-status'), label = el.querySelector('.label');
  if (!isWebMcpAvailable()) {
    el.dataset.state = 'unavailable';
    label.textContent = 'no agent in this browser — form works manually';
    el.title = 'Open in ChatGPT’s browser, or Chrome with chrome://flags/#enable-webmcp-testing.';
    return;
  }
  const { registered, gated } = await registerTools();
  el.dataset.state = 'ready';
  label.textContent = `${registered.length} tools offered · ${gated.length} need your approval`;
  el.title = registered.join('\n');
  logActivity('ready', `Offered ${registered.length} tools to your agent; ${gated.length} will ask you first`);
})();
