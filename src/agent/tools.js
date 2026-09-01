import {
  getState, fieldSpec, steps, setField, goToStep, proposeChanges, applyProposal,
  discardProposal, addDocument, setInterviewSlot, setSubmission, missingRequired, logActivity
} from '../state.js';
import { requestApproval } from './gate.js';

// Chrome's WebMCP preview hands arguments over as a JSON string, while the
// spec examples show a plain object. Accept both.
function readArgs(raw) {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw || '{}'); } catch { return {}; }
  }
  return raw || {};
}

const text = (value) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }] });

function fieldCatalogue() {
  return Object.entries(fieldSpec).map(([name, spec]) => ({
    name, label: spec.label, step: spec.step, type: spec.type,
    ...(spec.options ? { options: spec.options } : {}),
    value: getState().fields[name] || null
  }));
}

const SLOTS = [
  { id: 'slot-1', date: '2026-09-14', time: '09:30', location: 'Berlin — Consular Section' },
  { id: 'slot-2', date: '2026-09-14', time: '14:00', location: 'Berlin — Consular Section' },
  { id: 'slot-3', date: '2026-09-21', time: '11:15', location: 'Munich — Visa Centre' },
  { id: 'slot-4', date: '2026-10-02', time: '08:45', location: 'Berlin — Consular Section' }
];

// ── Tool definitions ────────────────────────────────────────────────
// Read-only and reversible tools run straight away. Anything a person would
// regret — booking a consulate slot, filing the application — goes through
// the approval gate first.

const TOOLS = [
  {
    name: 'get-application',
    description:
      'Returns the current visa application: every field with its value, which step it belongs to, uploaded documents, the booked interview slot and what is still missing. Call this before proposing changes.',
    inputSchema: { type: 'object', properties: {} },
    execute: () => {
      const s = getState();
      return text({
        step: s.step,
        fields: fieldCatalogue(),
        documents: s.documents.map((d) => ({ name: d.name, kind: d.kind })),
        interviewSlot: s.interviewSlot,
        submitted: !!s.submission,
        missing: missingRequired().map((m) => m.label),
        pendingProposal: s.proposal ? s.proposal.changes.length : 0
      });
    }
  },
  {
    name: 'propose-application-changes',
    description:
      'Stages values for one or more application fields WITHOUT applying them. The applicant sees a before/after list and decides whether to accept. This is the main way to fill the form: pass everything you extracted from the user\'s text at once. Field names come from get-application.',
    inputSchema: {
      type: 'object',
      properties: {
        changes: {
          type: 'object',
          description: 'Map of field name to new value, e.g. {"givenName":"Maria","nationality":"Ukraine"}'
        },
        note: { type: 'string', description: 'One line telling the applicant what you understood and where it came from' }
      },
      required: ['changes']
    },
    execute: (raw) => {
      const { changes, note } = readArgs(raw);
      if (!changes || typeof changes !== 'object') return text('No changes supplied.');
      const staged = proposeChanges(changes, { note });
      if (!staged.length) return text('Nothing to change — those values are already in the form.');
      logActivity('agent', `Proposed ${staged.length} change(s)`);
      return text({
        staged: staged.length,
        awaiting: 'The applicant must accept these before they are written into the form.',
        changes: staged.map((c) => ({ field: fieldSpec[c.field].label, from: c.from || '(empty)', to: c.to }))
      });
    }
  },
  {
    name: 'read-pasted-notes',
    description:
      'Returns whatever the applicant pasted into the notes box on the page — an employer letter, old application, loose notes. Read this first when they say "fill it in from what I pasted", then call propose-application-changes with what you extracted.',
    inputSchema: { type: 'object', properties: {} },
    execute: () => {
      const raw = (typeof window.__consularRawInput === 'function' ? window.__consularRawInput() : '').trim();
      if (!raw) return text('The notes box is empty. Ask the applicant to paste their details there, or give them to you directly.');
      return text({ notes: raw, hint: 'Extract what you can and stage it with propose-application-changes.' });
    }
  },
  {
    name: 'go-to-step',
    description: 'Moves the applicant to a step of the form so they can see what you are working on.',
    inputSchema: {
      type: 'object',
      properties: { step: { type: 'string', enum: steps.map((s) => s.id) } },
      required: ['step']
    },
    execute: (raw) => {
      const { step } = readArgs(raw);
      goToStep(step);
      return text(`Showing the ${steps.find((s) => s.id === step).title} step.`);
    }
  },
  {
    name: 'list-interview-slots',
    description: 'Lists appointment slots still available at the consulate. Reading them commits to nothing.',
    inputSchema: { type: 'object', properties: {} },
    execute: () => text({ slots: SLOTS, booked: getState().interviewSlot })
  },
  {
    name: 'book-interview-slot',
    dangerous: true,
    description:
      'Books a consulate interview slot. IRREVERSIBLE: the applicant is asked to approve, and the call waits for their decision. Slots cannot be rebooked once taken.',
    inputSchema: {
      type: 'object',
      properties: { slotId: { type: 'string', enum: SLOTS.map((s) => s.id) } },
      required: ['slotId']
    },
    execute: async (raw) => {
      const { slotId } = readArgs(raw);
      const slot = SLOTS.find((s) => s.id === slotId);
      if (!slot) return text(`No slot '${slotId}'. Call list-interview-slots first.`);
      const approved = await requestApproval({
        title: 'Book this interview slot?',
        summary: 'The agent wants to reserve an appointment at the consulate on your behalf.',
        detail: [
          { label: 'Date', value: `${slot.date} at ${slot.time}` },
          { label: 'Location', value: slot.location }
        ],
        consequence: 'Slots are limited and cannot be changed once booked.'
      });
      if (!approved) {
        logActivity('declined', 'Interview booking declined');
        return text('The applicant declined the booking. Nothing was reserved. Ask what they would prefer.');
      }
      setInterviewSlot(slot);
      logActivity('approved', `Interview booked — ${slot.date} ${slot.time}`);
      return text({ booked: slot, note: 'Confirmed by the applicant.' });
    }
  },
  {
    name: 'submit-application',
    dangerous: true,
    description:
      'Files the visa application with the consulate. IRREVERSIBLE and final: the applicant must approve, and the call waits for them. Check get-application for missing fields first.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const s = getState();
      if (s.submission) return text(`Already submitted as ${s.submission.reference}.`);
      const missing = missingRequired();
      if (missing.length) {
        return text({
          blocked: true,
          reason: 'The application is incomplete, so it was not submitted.',
          missing: missing.map((m) => m.label)
        });
      }
      const approved = await requestApproval({
        title: 'File this visa application?',
        summary: `You are about to submit the application for ${s.fields.givenName} ${s.fields.familyName}.`,
        detail: [
          { label: 'Purpose', value: s.fields.purpose },
          { label: 'Travel', value: `${s.fields.arrivalDate} → ${s.fields.departureDate}` },
          { label: 'Documents', value: `${s.documents.length} attached` },
          { label: 'Interview', value: s.interviewSlot ? `${s.interviewSlot.date} ${s.interviewSlot.time}` : 'not booked' }
        ],
        consequence: 'Once filed, the application cannot be edited or withdrawn online.'
      });
      if (!approved) {
        logActivity('declined', 'Submission declined');
        return text('The applicant declined. The application was NOT submitted and stays editable.');
      }
      const reference = `VA-${Date.now().toString(36).toUpperCase().slice(-8)}`;
      setSubmission({ reference, submittedAt: new Date().toISOString() });
      logActivity('approved', `Application submitted — ${reference}`);
      return text({ submitted: true, reference });
    }
  }
];

export function toolNames() {
  return TOOLS.map((t) => t.name);
}

export function isWebMcpAvailable() {
  try {
    return !!(document.modelContext && typeof document.modelContext.registerTool === 'function');
  } catch {
    return false;
  }
}

export async function registerTools() {
  if (!isWebMcpAvailable()) return { registered: [], available: false };
  const registered = [];
  await Promise.all(
    TOOLS.map((tool) =>
      document.modelContext
        .registerTool({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          execute: (args) => tool.execute(args)
        })
        .then(() => registered.push(tool.name))
        .catch((error) => console.warn(`Could not register '${tool.name}':`, error.message))
    )
  );
  return { registered, available: true, dangerous: TOOLS.filter((t) => t.dangerous).map((t) => t.name) };
}

export { TOOLS, SLOTS, applyProposal, discardProposal, setField, addDocument };
