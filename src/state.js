// Application state. The agent never mutates fields directly: it stages a
// proposal, the human sees exactly what would change, and only then applies.

const STEPS = [
  { id: 'applicant', title: 'Applicant' },
  { id: 'passport', title: 'Passport' },
  { id: 'travel', title: 'Travel' },
  { id: 'employment', title: 'Employment' },
  { id: 'review', title: 'Review & submit' }
];

const FIELDS = {
  givenName: { step: 'applicant', label: 'Given name', type: 'string' },
  familyName: { step: 'applicant', label: 'Family name', type: 'string' },
  dateOfBirth: { step: 'applicant', label: 'Date of birth', type: 'date' },
  nationality: { step: 'applicant', label: 'Nationality', type: 'string' },
  email: { step: 'applicant', label: 'Email', type: 'email' },
  phone: { step: 'applicant', label: 'Phone', type: 'string' },
  passportNumber: { step: 'passport', label: 'Passport number', type: 'string' },
  passportIssued: { step: 'passport', label: 'Issue date', type: 'date' },
  passportExpires: { step: 'passport', label: 'Expiry date', type: 'date' },
  passportCountry: { step: 'passport', label: 'Issuing country', type: 'string' },
  purpose: {
    step: 'travel',
    label: 'Purpose of travel',
    type: 'enum',
    options: ['Tourism', 'Business', 'Study', 'Family visit', 'Conference']
  },
  arrivalDate: { step: 'travel', label: 'Intended arrival', type: 'date' },
  departureDate: { step: 'travel', label: 'Intended departure', type: 'date' },
  accommodation: { step: 'travel', label: 'Accommodation address', type: 'text' },
  employer: { step: 'employment', label: 'Employer', type: 'string' },
  jobTitle: { step: 'employment', label: 'Job title', type: 'string' },
  monthlyIncome: { step: 'employment', label: 'Monthly income (EUR)', type: 'number' },
  employerAddress: { step: 'employment', label: 'Employer address', type: 'text' }
};

const listeners = new Set();

const state = {
  step: 'applicant',
  fields: Object.fromEntries(Object.keys(FIELDS).map((k) => [k, ''])),
  documents: [],
  proposal: null, // { changes: [{field, from, to}], note, source }
  interviewSlot: null,
  submission: null, // { reference, submittedAt }
  activity: []
};

function notify() {
  for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

export const fieldSpec = FIELDS;
export const steps = STEPS;

export function logActivity(kind, text) {
  state.activity.unshift({ kind, text, at: new Date().toLocaleTimeString() });
  state.activity = state.activity.slice(0, 40);
  notify();
}

export function setField(name, value, { silent } = {}) {
  if (!(name in FIELDS)) throw new Error(`Unknown field '${name}'`);
  state.fields[name] = value;
  if (!silent) notify();
}

export function goToStep(stepId) {
  if (!STEPS.some((s) => s.id === stepId)) throw new Error(`Unknown step '${stepId}'`);
  state.step = stepId;
  notify();
}

// The agent stages changes here rather than writing them straight in.
export function proposeChanges(updates, { note, source = 'agent' } = {}) {
  const changes = [];
  for (const [field, to] of Object.entries(updates)) {
    if (!(field in FIELDS)) continue;
    const from = state.fields[field];
    if (String(from) === String(to)) continue;
    changes.push({ field, from, to: String(to) });
  }
  state.proposal = changes.length ? { changes, note, source } : null;
  notify();
  return changes;
}

export function applyProposal() {
  if (!state.proposal) return 0;
  const { changes } = state.proposal;
  for (const { field, to } of changes) state.fields[field] = to;
  state.proposal = null;
  notify();
  return changes.length;
}

export function discardProposal() {
  const count = state.proposal?.changes.length || 0;
  state.proposal = null;
  notify();
  return count;
}

export function addDocument(doc) {
  state.documents.push(doc);
  notify();
}

export function setInterviewSlot(slot) {
  state.interviewSlot = slot;
  notify();
}

export function setSubmission(submission) {
  state.submission = submission;
  notify();
}

export function missingRequired() {
  return Object.entries(FIELDS)
    .filter(([name]) => !String(state.fields[name] || '').trim())
    .map(([name, spec]) => ({ name, label: spec.label, step: spec.step }));
}
