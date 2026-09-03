// Human approval gate for irreversible agent actions.
//
// WebMCP has no answer for this yet — "user prompting and elicitation" is an
// open question in the spec (webmachinelearning/webmcp#165). Until it lands,
// a tool that books a slot or files an application has to ask on its own.
//
// The gate holds the tool call open while the dialog is up, so the agent's
// call simply takes as long as the person needs to decide.

const ARM_DELAY_MS = 600; // guards against a click meant for the previous dialog
const DECISION_TIMEOUT_MS = 120000;

let current = null;
const queue = [];

function render() {
  const root = document.getElementById('gate-root');
  if (!current) {
    root.innerHTML = '';
    root.hidden = true;
    return;
  }
  const { title, summary, detail, consequence, armed, approveLabel } = current;
  root.hidden = false;
  root.innerHTML = `
    <div class="gate-backdrop"></div>
    <div class="gate-dialog" role="alertdialog" aria-modal="true" aria-labelledby="gate-title" tabindex="-1">
      <p class="gate-kicker">The agent is asking permission</p>
      <h2 id="gate-title">${escapeHtml(title)}</h2>
      <p class="gate-summary">${escapeHtml(summary)}</p>
      ${detail?.length ? `<dl class="gate-detail">${detail
        .map((d) => `<div><dt>${escapeHtml(d.label)}</dt><dd>${escapeHtml(String(d.value))}</dd></div>`)
        .join('')}</dl>` : ''}
      <p class="gate-consequence">${escapeHtml(consequence)}</p>
      <p class="gate-why">Asked here, on the page, because WebMCP has no way yet for a site to put this question into your chat. Your agent is waiting for your answer.</p>
      <div class="gate-actions">
        <button type="button" data-gate="reject" class="btn btn-ghost">Not now</button>
        <button type="button" data-gate="approve" class="btn btn-danger"${armed ? '' : ' disabled'}>
          ${escapeHtml(approveLabel || 'Approve')}
        </button>
      </div>
      ${armed ? '' : '<p class="gate-arming">Enabling in a moment…</p>'}
    </div>`;
  root.querySelector('[data-gate="reject"]').onclick = () => settle('declined');
  const approve = root.querySelector('[data-gate="approve"]');
  approve.onclick = () => current?.armed && settle('approved');
  root.querySelector('.gate-dialog').focus();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function settle(outcome) {
  if (!current) return;
  const { resolve, timeoutId, armTimerId } = current;
  clearTimeout(timeoutId);
  clearTimeout(armTimerId);
  current = null;
  render();
  resolve(outcome);
  if (queue.length) show(queue.shift());
}

function show(request) {
  current = { ...request, armed: false };
  current.armTimerId = setTimeout(() => {
    if (current === null) return;
    current.armed = true;
    render();
  }, ARM_DELAY_MS);
  current.timeoutId = setTimeout(() => settle('timeout'), DECISION_TIMEOUT_MS);
  render();
}

/**
 * Ask the person to approve an irreversible action.
 * Resolves 'approved' | 'declined' | 'timeout'.
 */
export function requestApproval({ title, summary, detail = [], consequence, approveLabel }) {
  return new Promise((resolve) => {
    const request = { title, summary, detail, consequence, approveLabel, resolve };
    if (current) queue.push(request);
    else show(request);
  });
}
