import {
  getState, FIELDS, SCREENS, VISA_CATEGORIES, SLOTS, MRV_FEE_USD,
  goToScreen, applyChanges, undoLastBatch, attachDocument, setFee, setInterview, setSubmission,
  missingRequired, runRules, blockingProblems, logActivity
} from '../state.js';
import { requestApproval } from './gate.js';

// Chrome's WebMCP preview passes arguments as a JSON string; the spec shows an object.
function readArgs(raw) {
  if (typeof raw === 'string') { try { return JSON.parse(raw || '{}'); } catch { return {}; } }
  return raw || {};
}
const text = (v) => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v) }] });

// One sentence every gated tool starts with, so the model sees it at selection time.
const APPROVAL_TAG = '[APPROVAL REQUIRED — the applicant confirms in a dialog on the page; this call waits for their answer]';

function gateOutcomeText(outcome, what) {
  if (outcome === 'declined') return `The applicant declined. ${what} was NOT done. Ask what they would prefer instead.`;
  if (outcome === 'timeout') return `No decision was made within the time limit, so ${what.toLowerCase()} was NOT done. The applicant may have stepped away — let them know it is still possible when they return.`;
  return null;
}

function fieldCatalogue() {
  const s = getState();
  return Object.entries(FIELDS).map(([name, sp]) => ({
    name, n: sp.n, label: sp.label, screen: sp.screen, type: sp.type,
    ...(sp.options ? { options: sp.options } : {}),
    ...(sp.optional ? { optional: true } : {}),
    ...(sp.humanOnly ? { humanOnly: true } : {}),
    value: s.fields[name] || null
  }));
}

// ── The policy: declared up front, readable by agent and applicant alike ──
export const ACTION_POLICY = {
  consequential: [
    { tool: 'pay-mrv-fee', why: `Charges the non-refundable US$${MRV_FEE_USD} visa application fee to the applicant's card.` },
    { tool: 'schedule-interview', why: 'Reserves a consulate appointment. Slots are scarce; rescheduling is limited to once.' },
    { tool: 'submit-application', why: 'Files the application with the consulate. It cannot be edited or withdrawn afterwards.' }
  ],
  howApprovalWorks:
    'The page opens a dialog in the browser showing exactly what will happen. The tool call stays pending until the applicant approves or declines there — the agent cannot skip or answer this dialog, even if the user asks it to. WebMCP has no channel yet for a page to ask the user through the chat itself (spec issue #165), so the dialog appears on the page; tell the user to look there.',
  reversible: {
    tools: ['fill-fields', 'attach-document', 'go-to-screen', 'undo-last-changes'],
    why: 'These change only the draft. They run immediately; the applicant sees every field you touched highlighted with its source and can undo your last batch with one click. Do not ask for permission before using them.'
  },
  humanOnly: {
    fields: Object.entries(FIELDS).filter(([, sp]) => sp.humanOnly).map(([n, sp]) => `${sp.n} ${sp.label}`),
    why: 'Security and background questions are legal declarations. The agent may explain them but must not answer on the applicant\'s behalf.'
  },
  readOnly: ['get-action-policy', 'get-visa-categories', 'get-application', 'read-documents', 'validate-application', 'list-interview-slots']
};

const TOOLS = [
  {
    name: 'get-action-policy',
    description:
      'Call this first. Tells you which actions are consequential and will pause for the applicant\'s approval in a dialog on the page, which ones just change the draft and run immediately, and which fields only the applicant may answer. Lets you warn the applicant before starting anything that will ask them to confirm.',
    inputSchema: { type: 'object', properties: {} },
    execute: () => text(ACTION_POLICY)
  },
  {
    name: 'get-visa-categories',
    description:
      'Lists the nonimmigrant visa categories this form supports, with what each is for and whether an approved petition is required first. Use it to help the applicant choose the right category from a description of their trip — most people are unsure whether they need B-1 or B-2, or whether a conference talk counts as work.',
    inputSchema: { type: 'object', properties: {} },
    execute: () => text({ categories: VISA_CATEGORIES, chosen: getState().fields.visaCategory || null })
  },
  {
    name: 'get-application',
    description:
      'Returns the whole application: every field with its number, screen, type, allowed options, current value and whether only the applicant may answer it; plus documents, fee, interview and submission status. Call it before proposing changes so you use the right field names and options.',
    inputSchema: { type: 'object', properties: {} },
    execute: () => {
      const s = getState();
      return text({
        screen: s.screen,
        fields: fieldCatalogue(),
        documents: s.documents.map((d) => ({ id: d.id, kind: d.kind, attached: d.attached })),
        fee: s.fee ? { paid: true, reference: s.fee.reference } : { paid: false, amountUSD: MRV_FEE_USD },
        interview: s.interview,
        submission: s.submission,
        missingRequired: missingRequired().map((m) => `${m.n} ${m.label}`),
        fieldsYouWroteRecently: Object.keys(s.recent).length
      });
    }
  },
  {
    name: 'read-documents',
    description:
      'Returns the applicant\'s documents as text — whatever they uploaded or pasted (a passport page, letters, bookings, itineraries) plus their own notes for things no document contains. Read ALL of them before filling the form: details are spread across them and they do not always agree with each other. Note which document each value came from.',
    inputSchema: { type: 'object', properties: {} },
    execute: () => text({ documents: getState().documents.map((d) => ({ id: d.id, kind: d.kind, attached: d.attached, text: d.text })) })
  },
  {
    name: 'fill-fields',
    description:
      'Writes values into the application right away — no approval needed, this only changes the draft. Every field you set is highlighted for the applicant with the source you give, and they can undo your whole batch with one click, so pass everything you extracted at once. Use passport spelling for names. Fields marked humanOnly are refused. Dates as YYYY-MM-DD; enum fields must use one of their options.',
    inputSchema: {
      type: 'object',
      properties: {
        changes: { type: 'object', description: 'Field name → value, e.g. {"surname":"KOVALENKO","visaCategory":"B-1"}' },
        sources: { type: 'object', description: 'Field name → where you read it, e.g. {"surname":"passport","employer":"employer letter"}' },
        note: { type: 'string', description: 'One or two lines for the applicant: what you did and anything you inferred or found inconsistent' }
      },
      required: ['changes']
    },
    execute: (raw) => {
      const { changes, sources, note } = readArgs(raw);
      if (!changes || typeof changes !== 'object') return text('No changes supplied.');
      let applied, refused;
      try { ({ applied, refused } = applyChanges(changes, { note, sources: sources || {} })); }
      catch (error) { return text({ refused: true, reason: error.message }); }
      if (applied.length) logActivity('agent', `Filled ${applied.length} field(s)`);
      return text({
        applied: applied.length,
        note: applied.length ? 'Written into the form. The applicant sees these highlighted and can undo them.' : 'Nothing new to write.',
        changes: applied.map((c) => ({ field: `${FIELDS[c.field].n} ${FIELDS[c.field].label}`, from: c.from || '(empty)', to: c.to, source: c.source })),
        refused
      });
    }
  },
  {
    name: 'undo-last-changes',
    description: 'Reverts the last batch of fields you wrote with fill-fields. Use it when the applicant says you got something wrong.',
    inputSchema: { type: 'object', properties: {} },
    execute: () => {
      const n = undoLastBatch();
      logActivity('agent', n ? `Undid ${n} field(s)` : 'Nothing to undo');
      return text(n ? `Reverted ${n} field(s) to their previous values.` : 'There is nothing to undo.');
    }
  },
  {
    name: 'attach-document',
    description: 'Marks one of the applicant\'s documents as attached to the application (reversible). Attach every document you took values from — the itinerary and hotel confirmation evidence the travel dates and address, so attach them too. Notes are not a document and cannot be attached.',
    inputSchema: {
      type: 'object',
      properties: { documentId: { type: 'string', description: 'A document id from read-documents' }, attached: { type: 'boolean' } },
      required: ['documentId']
    },
    execute: (raw) => {
      const { documentId, attached = true } = readArgs(raw);
      if (documentId === 'notes') return text('Notes are for reading only; they are not a supporting document.');
      let doc;
      try { doc = attachDocument(documentId, attached); } catch (error) { return text({ refused: true, reason: error.message }); }
      logActivity('agent', `${attached ? 'Attached' : 'Detached'} ${doc.kind}`);
      return text({ documentId, attached: doc.attached });
    }
  },
  {
    name: 'go-to-screen',
    description: 'Shows a part of the form to the applicant so they can see what you are working on.',
    inputSchema: { type: 'object', properties: { screen: { type: 'string', enum: SCREENS.map((s) => s.id) } }, required: ['screen'] },
    execute: (raw) => { const { screen } = readArgs(raw); goToScreen(screen); return text(`Showing part ${SCREENS.find((s) => s.id === screen).part}: ${SCREENS.find((s) => s.id === screen).title}.`); }
  },
  {
    name: 'validate-application',
    description:
      'Runs the consulate\'s checks against the current form and documents: names vs passport, passport validity, accommodation coverage, petition requirements, unanswered security questions. Returns each problem with the rule it breaks and what to do. Run it before paying or submitting — problems here are the usual reasons for refusal.',
    inputSchema: { type: 'object', properties: {} },
    execute: () => {
      const findings = runRules();
      const missing = missingRequired();
      const errors = findings.filter((f) => f.severity === 'error');
      logActivity('agent', findings.length ? `Validation: ${errors.length} blocking, ${findings.length - errors.length} advisory` : 'Validation: clean');
      return text({
        ok: errors.length === 0 && missing.length === 0,
        blocking: errors.map((f) => ({ rule: `${f.id} ${f.title}`, finding: f.finding })),
        advisory: findings.filter((f) => f.severity === 'warning').map((f) => ({ rule: `${f.id} ${f.title}`, finding: f.finding })),
        missingRequired: missing.map((m) => `${m.n} ${m.label}`),
        note: errors.length ? 'Blocking problems must be fixed before submission. Advisory ones are worth telling the applicant about.' : undefined
      });
    }
  },
  {
    name: 'list-interview-slots',
    description: 'Lists open interview appointments. Reading them reserves nothing.',
    inputSchema: { type: 'object', properties: {} },
    execute: () => text({ slots: SLOTS, booked: getState().interview, feePaid: !!getState().fee })
  },
  {
    name: 'pay-mrv-fee',
    gated: true,
    description:
      `${APPROVAL_TAG} Pays the non-refundable US$${MRV_FEE_USD} visa application (MRV) fee with the card on file. Required before an interview can be scheduled. Run validate-application first — the fee is lost if the application is later refused for a preventable reason.`,
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const s = getState();
      if (s.fee) return text(`The fee was already paid (reference ${s.fee.reference}).`);
      const problems = blockingProblems();
      const outcome = await requestApproval({
        title: `Pay the US$${MRV_FEE_USD} application fee?`,
        summary: 'The agent wants to charge the visa application fee to the card ending 4417.',
        detail: [
          { label: 'Amount', value: `US$${MRV_FEE_USD}.00` },
          { label: 'Payee', value: 'Consular fee service (demo)' },
          { label: 'Refundable', value: 'No' },
          { label: 'Open issues', value: problems.length ? `${problems.length} — validation is not clean` : 'none' }
        ],
        consequence: 'This fee is never refunded, including if the application is refused.',
        approveLabel: `Pay US$${MRV_FEE_USD}`
      });
      const stop = gateOutcomeText(outcome, 'The payment');
      if (stop) { logActivity(outcome, 'Fee payment not completed'); return text(stop); }
      const reference = `MRV-${Date.now().toString(36).toUpperCase().slice(-7)}`;
      setFee({ paid: true, amount: MRV_FEE_USD, reference, at: new Date().toISOString() });
      logActivity('approved', `Fee paid — ${reference}`);
      return text({ paid: true, amountUSD: MRV_FEE_USD, reference, note: 'Confirmed by the applicant.' });
    }
  },
  {
    name: 'schedule-interview',
    gated: true,
    description:
      `${APPROVAL_TAG} Books a consulate interview slot. Requires the fee to be paid. Slots are scarce and can be rescheduled only once. Call list-interview-slots first.`,
    inputSchema: { type: 'object', properties: { slotId: { type: 'string', enum: SLOTS.map((s) => s.id) } }, required: ['slotId'] },
    execute: async (raw) => {
      const { slotId } = readArgs(raw);
      const s = getState();
      if (!s.fee) return text({ blocked: true, reason: 'The application fee has not been paid. Interviews can only be scheduled after payment (pay-mrv-fee).' });
      const slot = SLOTS.find((x) => x.id === slotId);
      if (!slot) return text(`No slot '${slotId}'. Call list-interview-slots.`);
      const outcome = await requestApproval({
        title: 'Book this interview?',
        summary: 'The agent wants to reserve a consulate appointment for you.',
        detail: [{ label: 'When', value: `${slot.date} at ${slot.time}` }, { label: 'Where', value: slot.location }],
        consequence: 'Appointments can be rescheduled once; a no-show forfeits the fee.',
        approveLabel: 'Book it'
      });
      const stop = gateOutcomeText(outcome, 'The booking');
      if (stop) { logActivity(outcome, 'Interview not booked'); return text(stop); }
      setInterview(slot);
      logActivity('approved', `Interview — ${slot.date} ${slot.time}`);
      return text({ booked: slot, note: 'Confirmed by the applicant.' });
    }
  },
  {
    name: 'submit-application',
    gated: true,
    description:
      `${APPROVAL_TAG} Files the application with the consulate. Final: it cannot be edited or withdrawn. Refused automatically if validation has problems, required fields are missing, the fee is unpaid or no interview is booked.`,
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const s = getState();
      if (s.submission) return text(`Already filed as ${s.submission.reference}.`);
      const problems = blockingProblems(), missing = missingRequired();
      const blockers = [];
      if (problems.length) blockers.push(`${problems.length} blocking validation problem(s)`);
      if (missing.length) blockers.push(`${missing.length} required field(s) empty`);
      if (!s.fee) blockers.push('fee not paid');
      if (!s.interview) blockers.push('no interview booked');
      if (blockers.length) {
        return text({ blocked: true, reason: 'Not submitted: ' + blockers.join('; ') + '.', problems: problems.map((p) => p.finding), missingRequired: missing.map((m) => `${m.n} ${m.label}`) });
      }
      const outcome = await requestApproval({
        title: 'File the application?',
        summary: `Submit the ${s.fields.visaCategory} application for ${s.fields.givenNames} ${s.fields.surname} to the consulate.`,
        detail: [
          { label: 'Travel', value: `${s.fields.arrivalDate} → ${s.fields.departureDate}` },
          { label: 'Interview', value: `${s.interview.date} ${s.interview.time}` },
          { label: 'Documents', value: `${s.documents.filter((d) => d.attached).length} attached` },
          { label: 'Checks', value: 'all passed' }
        ],
        consequence: 'After filing, nothing can be changed. Errors mean a new application and a new fee.',
        approveLabel: 'File it'
      });
      const stop = gateOutcomeText(outcome, 'The submission');
      if (stop) { logActivity(outcome, 'Submission not filed'); return text(stop); }
      const reference = `AA00${Date.now().toString(36).toUpperCase().slice(-6)}`;
      setSubmission({ reference, at: new Date().toISOString() });
      logActivity('approved', `Application filed — ${reference}`);
      return text({ submitted: true, reference });
    }
  }
];

export function isWebMcpAvailable() {
  try { return !!(document.modelContext && typeof document.modelContext.registerTool === 'function'); } catch { return false; }
}

export async function registerTools() {
  if (!isWebMcpAvailable()) return { registered: [], available: false, gated: [] };
  const registered = [];
  await Promise.all(TOOLS.map((tool) =>
    document.modelContext.registerTool({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      // MCP-style hints; harmless where the browser ignores them
      annotations: tool.gated ? { destructiveHint: true, readOnlyHint: false } : undefined,
      execute: (args) => tool.execute(args)
    }).then(() => registered.push(tool.name))
      .catch((error) => console.warn(`Could not register '${tool.name}':`, error.message))
  ));
  return { registered, available: true, gated: TOOLS.filter((t) => t.gated).map((t) => t.name) };
}

export { TOOLS };
