import './style.css';
import {
  subscribe, getState, fieldSpec, steps, setField, goToStep,
  applyProposal, discardProposal, logActivity
} from './state.js';
import { registerTools, isWebMcpAvailable, toolNames } from './agent/tools.js';

const form = document.getElementById('application-form');
const stepper = document.getElementById('stepper');
const proposalCard = document.getElementById('proposal-card');
const proposalDiff = document.getElementById('proposal-diff');
const proposalNote = document.getElementById('proposal-note');
const activityList = document.getElementById('activity');
const statusEl = document.getElementById('agent-status');

function fieldControl(name, spec, value) {
  const id = `f-${name}`;
  if (spec.type === 'enum') {
    return `<select id="${id}" name="${name}" data-field="${name}">
      <option value="">—</option>
      ${spec.options.map((o) => `<option value="${o}"${o === value ? ' selected' : ''}>${o}</option>`).join('')}
    </select>`;
  }
  if (spec.type === 'text') {
    return `<textarea id="${id}" name="${name}" data-field="${name}" rows="2">${escapeHtml(value)}</textarea>`;
  }
  const type = spec.type === 'number' ? 'number' : spec.type === 'date' ? 'date' : spec.type === 'email' ? 'email' : 'text';
  return `<input id="${id}" name="${name}" data-field="${name}" type="${type}" value="${escapeHtml(value)}" />`;
}

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function nextStep(current) {
  const i = steps.findIndex((s) => s.id === current);
  return steps[Math.min(i + 1, steps.length - 1)].id;
}

function prevStep(current) {
  const i = steps.findIndex((s) => s.id === current);
  return i > 0 ? steps[i - 1].id : null;
}

function renderStepper(state) {
  stepper.innerHTML = steps
    .map((s) => {
      const done = Object.entries(fieldSpec)
        .filter(([, spec]) => spec.step === s.id)
        .every(([n]) => String(state.fields[n] || '').trim());
      const cls = [s.id === state.step ? 'active' : '', done && s.id !== 'review' ? 'done' : ''].filter(Boolean).join(' ');
      return `<button type="button" class="step ${cls}" data-step="${s.id}">
        <span class="step-dot"></span>${s.title}</button>`;
    })
    .join('');
}

function renderReview(state) {
  const grouped = steps
    .filter((s) => s.id !== 'review')
    .map((s) => {
      const rows = Object.entries(fieldSpec)
        .filter(([, spec]) => spec.step === s.id)
        .map(([name, spec]) => {
          const v = state.fields[name];
          return `<div class="review-row${v ? '' : ' empty'}">
            <dt>${spec.label}</dt><dd>${v ? escapeHtml(v) : 'not filled in'}</dd></div>`;
        })
        .join('');
      return `<section class="review-group"><h3>${s.title}</h3><dl>${rows}</dl></section>`;
    })
    .join('');

  const slot = state.interviewSlot;
  const submitted = state.submission;

  return `
    <h1>Review &amp; submit</h1>
    <p class="muted">Nothing here is sent until you approve it.</p>
    ${grouped}
    <section class="review-group">
      <h3>Interview</h3>
      <p>${slot ? `${slot.date} at ${slot.time} — ${slot.location}` : 'No slot booked yet.'}</p>
    </section>
    ${submitted
      ? `<div class="submitted-banner"><strong>Filed.</strong> Reference ${submitted.reference}</div>`
      : `<p class="muted small">Ask your agent to book an interview or file the application — it will ask you before doing either.</p>`}
  `;
}

function renderForm(state) {
  if (state.step === 'review') {
    form.innerHTML = renderReview(state);
    return;
  }
  const step = steps.find((s) => s.id === state.step);
  const fields = Object.entries(fieldSpec).filter(([, spec]) => spec.step === state.step);
  const pending = new Set((state.proposal?.changes || []).map((c) => c.field));

  form.innerHTML = `
    <h1>${step.title}</h1>
    <p class="muted">Type it yourself, or let the agent draft it and accept what it suggests.</p>
    <div class="grid">
      ${fields
        .map(
          ([name, spec]) => `
        <label class="field${pending.has(name) ? ' proposed' : ''}">
          <span class="field-label">${spec.label}${pending.has(name) ? '<i class="pending-dot" title="the agent suggests a value"></i>' : ''}</span>
          ${fieldControl(name, spec, state.fields[name])}
        </label>`
        )
        .join('')}
    </div>
    <div class="step-nav">
      ${prevStep(state.step) ? `<button type="button" class="btn btn-ghost" data-nav="${prevStep(state.step)}">Back</button>` : '<span></span>'}
      <button type="button" class="btn btn-primary" data-nav="${nextStep(state.step)}">
        ${nextStep(state.step) === 'review' ? 'Review' : 'Continue'}
      </button>
    </div>`;
}

function renderProposal(state) {
  const proposal = state.proposal;
  proposalCard.hidden = !proposal;
  if (!proposal) return;
  proposalNote.textContent = proposal.note || 'Review these before they go into the form.';
  proposalDiff.innerHTML = proposal.changes
    .map(
      (c) => `<li>
        <span class="diff-field">${fieldSpec[c.field].label}</span>
        <span class="diff-from">${c.from ? escapeHtml(c.from) : 'empty'}</span>
        <span class="diff-arrow">→</span>
        <span class="diff-to">${escapeHtml(c.to)}</span>
      </li>`
    )
    .join('');
}

function renderActivity(state) {
  activityList.innerHTML = state.activity.length
    ? state.activity.map((a) => `<li class="act act-${a.kind}"><span>${escapeHtml(a.text)}</span><time>${a.at}</time></li>`).join('')
    : '<li class="muted small">Nothing yet.</li>';
}

subscribe((state) => {
  renderStepper(state);
  renderForm(state);
  renderProposal(state);
  renderActivity(state);
});

stepper.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-step]');
  if (btn) goToStep(btn.dataset.step);
});

form.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) goToStep(nav.dataset.nav);
});

form.addEventListener('input', (e) => {
  const field = e.target.dataset?.field;
  if (field) setField(field, e.target.value, { silent: true });
});

document.getElementById('apply-proposal').onclick = () => {
  const n = applyProposal();
  logActivity('applied', `Accepted ${n} change(s)`);
};
document.getElementById('discard-proposal').onclick = () => {
  const n = discardProposal();
  logActivity('discarded', `Discarded ${n} suggestion(s)`);
};

// ── Agent status ────────────────────────────────────────────────────
async function initAgent() {
  const label = statusEl.querySelector('.label');
  if (!isWebMcpAvailable()) {
    statusEl.dataset.state = 'unavailable';
    label.textContent = 'no WebMCP in this browser';
    statusEl.title =
      'Open in ChatGPT’s in-app browser, or Chrome with chrome://flags/#enable-webmcp-testing enabled.';
    document.getElementById('raw-hint').textContent =
      'This browser has no WebMCP, so the form works as an ordinary form. Open it in an agent browser to hand the typing over.';
    return;
  }
  const { registered, dangerous } = await registerTools();
  statusEl.dataset.state = 'ready';
  label.textContent = `${registered.length} tools offered to your agent`;
  statusEl.title = `${registered.join(', ')}\nApproval required: ${dangerous.join(', ')}`;
  document.getElementById('raw-hint').textContent =
    'Your agent can read this box. Try: “read the notes on the page and fill in the application”.';
  logActivity('ready', `Published ${registered.length} tools (${dangerous.length} need approval)`);
}

initAgent();

// Exposed so a tool can read what the applicant pasted.
window.__consularRawInput = () => document.getElementById('raw-input').value;
