// Application state for a nonimmigrant visa application modelled on the
// U.S. DS-160 (demo — not affiliated with any government).
//
// The agent never writes a field directly: it stages a proposal, the applicant
// sees before/after with provenance, and applies it. Some answers are
// human-only and cannot be proposed at all.

export const VISA_CATEGORIES = [
  {
    code: 'B-1', name: 'Business visitor',
    summary: 'Consulting with business associates, attending a conference or convention, negotiating a contract. No employment in the U.S.',
    petition: false
  },
  {
    code: 'B-2', name: 'Tourism, visiting, medical treatment',
    summary: 'Vacation, visiting friends or relatives, medical treatment, amateur events with no payment.',
    petition: false
  },
  {
    code: 'F-1', name: 'Academic student',
    summary: 'Full-time study at an accredited college, university, seminary or language program. Requires Form I-20 from the school.',
    petition: false, prerequisite: 'Form I-20 (SEVIS ID)'
  },
  {
    code: 'J-1', name: 'Exchange visitor',
    summary: 'Approved exchange programs: scholars, interns, trainees, au pairs, camp counselors. Requires Form DS-2019 from the sponsor.',
    petition: false, prerequisite: 'Form DS-2019'
  },
  {
    code: 'H-1B', name: 'Specialty occupation',
    summary: 'Working in a field that requires specialised knowledge, for a U.S. employer who has an approved petition on your behalf.',
    petition: true, prerequisite: 'Approved Form I-129 petition (receipt number)'
  },
  {
    code: 'L-1', name: 'Intracompany transferee',
    summary: 'Transferring within the same company to a U.S. office as a manager, executive or specialised-knowledge employee.',
    petition: true, prerequisite: 'Approved Form I-129 petition (receipt number)'
  },
  {
    code: 'O-1', name: 'Extraordinary ability',
    summary: 'Sustained national or international acclaim in sciences, arts, education, business or athletics.',
    petition: true, prerequisite: 'Approved Form I-129 petition (receipt number)'
  }
];

export const SCREENS = [
  { id: 'category', title: 'Visa category', part: 1 },
  { id: 'personal', title: 'Personal information', part: 2 },
  { id: 'passport', title: 'Passport', part: 3 },
  { id: 'travel', title: 'Travel', part: 4 },
  { id: 'contact', title: 'U.S. point of contact', part: 5 },
  { id: 'work', title: 'Work and education', part: 6 },
  { id: 'security', title: 'Security and background', part: 7 },
  { id: 'documents', title: 'Supporting documents', part: 8 },
  { id: 'review', title: 'Review, fee and submission', part: 9 }
];

// type: string | text | date | number | enum | yesno
// humanOnly: the agent may read but never propose this field
export const FIELDS = {
  visaCategory: { screen: 'category', n: '1.1', label: 'Visa category', type: 'enum', options: VISA_CATEGORIES.map((c) => c.code) },
  petitionNumber: { screen: 'category', n: '1.2', label: 'Petition receipt number', type: 'string', hint: 'Only for H-1B, L-1, O-1', optional: true },

  surname: { screen: 'personal', n: '2.1', label: 'Surname (as in passport)', type: 'string' },
  givenNames: { screen: 'personal', n: '2.2', label: 'Given names (as in passport)', type: 'string' },
  otherNames: { screen: 'personal', n: '2.3', label: 'Other names used', type: 'string', optional: true },
  sex: { screen: 'personal', n: '2.4', label: 'Sex', type: 'enum', options: ['Female', 'Male'] },
  maritalStatus: { screen: 'personal', n: '2.5', label: 'Marital status', type: 'enum', options: ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'] },
  dateOfBirth: { screen: 'personal', n: '2.6', label: 'Date of birth', type: 'date' },
  birthCity: { screen: 'personal', n: '2.7', label: 'City of birth', type: 'string' },
  birthCountry: { screen: 'personal', n: '2.8', label: 'Country of birth', type: 'string' },
  nationality: { screen: 'personal', n: '2.9', label: 'Nationality', type: 'string' },
  nationalId: { screen: 'personal', n: '2.10', label: 'National identification number', type: 'string', optional: true },
  email: { screen: 'personal', n: '2.11', label: 'Email address', type: 'email' },
  phone: { screen: 'personal', n: '2.12', label: 'Primary phone', type: 'string' },
  homeAddress: { screen: 'personal', n: '2.13', label: 'Home address', type: 'text' },

  passportNumber: { screen: 'passport', n: '3.1', label: 'Passport number', type: 'string' },
  passportCountry: { screen: 'passport', n: '3.2', label: 'Issuing country', type: 'string' },
  passportIssueCity: { screen: 'passport', n: '3.3', label: 'City of issue', type: 'string' },
  passportIssued: { screen: 'passport', n: '3.4', label: 'Issue date', type: 'date' },
  passportExpires: { screen: 'passport', n: '3.5', label: 'Expiry date', type: 'date' },
  passportLost: { screen: 'passport', n: '3.6', label: 'Ever lost or had a passport stolen?', type: 'yesno' },

  purpose: { screen: 'travel', n: '4.1', label: 'Specific purpose of trip', type: 'text' },
  arrivalDate: { screen: 'travel', n: '4.2', label: 'Intended date of arrival', type: 'date' },
  departureDate: { screen: 'travel', n: '4.3', label: 'Intended date of departure', type: 'date' },
  usAddress: { screen: 'travel', n: '4.4', label: 'Address where you will stay in the U.S.', type: 'text' },
  tripPayer: { screen: 'travel', n: '4.5', label: 'Who is paying for your trip?', type: 'enum', options: ['Self', 'Employer', 'Other person', 'Other company/organisation'] },
  travelledBefore: { screen: 'travel', n: '4.6', label: 'Have you ever been to the U.S.?', type: 'yesno' },

  contactName: { screen: 'contact', n: '5.1', label: 'Contact person or organisation', type: 'string' },
  contactRelationship: { screen: 'contact', n: '5.2', label: 'Relationship to you', type: 'enum', options: ['Business associate', 'Employer', 'Relative', 'Friend', 'School', 'Other'] },
  contactAddress: { screen: 'contact', n: '5.3', label: 'Contact address', type: 'text' },
  contactPhone: { screen: 'contact', n: '5.4', label: 'Contact phone', type: 'string', optional: true },

  occupation: { screen: 'work', n: '6.1', label: 'Primary occupation', type: 'string' },
  employer: { screen: 'work', n: '6.2', label: 'Present employer or school', type: 'string' },
  employerAddress: { screen: 'work', n: '6.3', label: 'Employer address', type: 'text' },
  employedSince: { screen: 'work', n: '6.4', label: 'Start date', type: 'date' },
  monthlyIncome: { screen: 'work', n: '6.5', label: 'Monthly income (local currency)', type: 'number' },
  duties: { screen: 'work', n: '6.6', label: 'Briefly describe your duties', type: 'text' },

  secDisease: { screen: 'security', n: '7.1', label: 'Do you have a communicable disease of public health significance?', type: 'yesno', humanOnly: true },
  secArrest: { screen: 'security', n: '7.2', label: 'Have you ever been arrested or convicted for any offence or crime?', type: 'yesno', humanOnly: true },
  secDrugs: { screen: 'security', n: '7.3', label: 'Have you ever violated any law relating to controlled substances?', type: 'yesno', humanOnly: true },
  secTerror: { screen: 'security', n: '7.4', label: 'Do you seek to engage in espionage, sabotage or terrorist activities?', type: 'yesno', humanOnly: true },
  secOverstay: { screen: 'security', n: '7.5', label: 'Have you ever overstayed a visa or been deported from any country?', type: 'yesno', humanOnly: true }
};

// The sample applicant: everything Maria already has, as an agent would read it.
// Three discrepancies are planted on purpose — see rules below.
export const SAMPLE_DOCUMENTS = [
  {
    id: 'passport', kind: 'Passport — biographic page',
    text: `TYPE P  CODE UKR  PASSPORT No FE882140
SURNAME/ПРІЗВИЩЕ         KOVALENKO
GIVEN NAMES/ІМ'Я          MARIIA
NATIONALITY               UKRAINE
DATE OF BIRTH             14 MAR 1991
SEX F   PLACE OF BIRTH    LVIV / UKR
DATE OF ISSUE             03 AUG 2021   AUTHORITY 4601
DATE OF EXPIRY            14 JUN 2027
P<UKRKOVALENKO<<MARIIA<<<<<<<<<<<<<<<<<<<<<<<<
FE882140<7UKR9103147F2706148<<<<<<<<<<<<<<<04`
  },
  {
    id: 'employer', kind: 'Employer letter',
    text: `NOLTIC LLC · Heroiv UPA St. 73, Lviv 79018, Ukraine · +380 32 297 1120

To whom it may concern,

This letter confirms that Ms. Maria Kovalenko has been employed by Noltic LLC since 2 March 2020 as a Senior Salesforce Developer. Her current gross salary is UAH 132,000 per month. Her responsibilities include designing and building Lightning Web Components, integrating Salesforce with external systems, and leading a team of three developers.

Ms. Kovalenko will attend the Salesforce Developer Summit in San Francisco from 13 to 16 October 2026 as a speaker. Noltic LLC covers all travel and accommodation costs. She will return to her position in Lviv on 20 October 2026.

Ihor Melnyk, CEO — 21 August 2026`
  },
  {
    id: 'invitation', kind: 'Conference invitation (email)',
    text: `From: speakers@devsummit.example
Subject: Speaker confirmation — Salesforce Developer Summit 2026

Dear Maria,
We are delighted to confirm your session "Agents in the Lightning UI" at the Salesforce Developer Summit, Moscone Center West, 800 Howard St, San Francisco, CA 94103. The conference runs 13–16 October 2026. Please contact Dana Whitfield (Program Chair, +1 415 555 0188) for any letters you need for your visa.`
  },
  {
    id: 'flight', kind: 'Flight itinerary',
    text: `BOOKING REF 7KQ2LM · Passenger KOVALENKO/MARIIA MS
LH 1493  LWO 12OCT26 06:40 → FRA 08:55
UA  59   FRA 12OCT26 10:15 → SFO 13:05
UA  58   SFO 19OCT26 16:20 → FRA 12:35 (+1)
LH 1492  FRA 20OCT26 14:10 → LWO 17:45`
  },
  {
    id: 'notes', kind: 'Your own notes', editable: true,
    text: `Marital status: single. Never been to the U.S. before. Never lost a passport.
Passport was issued in Lviv.
Email maria.kovalenko@example.com, mobile +380 67 555 0142.
Home address: vul. Zelena 109, apt 14, Lviv 79035, Ukraine.`
  },
  {
    id: 'hotel', kind: 'Hotel confirmation',
    text: `Hotel Zephyr Fisherman's Wharf · 250 Beach St, San Francisco, CA 94133
Guest: Maria Kovalenko · Confirmation 88214-ZF
Check-in  Mon 12 Oct 2026
Check-out Sun 18 Oct 2026   (6 nights, Queen room, non-refundable)
Billed to: Noltic LLC`
  }
];

// Read the passport's machine-readable zone: P<UKRKOVALENKO<<MARIIA<<<<
export function passportNamesFrom(documents) {
  for (const d of documents) {
    for (const raw of (d.text || '').split('\n')) {
      // TD3 line 1: P, type, 3-letter country, SURNAME<<GIVEN<NAMES, padded with <
      const line = raw.replace(/\s+/g, '');
      const m = line.length >= 30 && (line.match(/</g) || []).length >= 5 ? line.match(/^P[<A-Z][A-Z]{3}([A-Z<]*<<[A-Z<]*)$/) : null;
      if (!m) continue;
      const [surname, given] = m[1].split('<<');
      if (!surname) continue;
      return { surname: surname.replace(/</g, ' ').trim(), given: (given || '').replace(/</g, ' ').trim() };
    }
  }
  return null;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function toIso(text) {
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const dmy = text.match(/(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{4})/);
  if (dmy && MONTHS[dmy[2].toLowerCase()]) return `${dmy[3]}-${String(MONTHS[dmy[2].toLowerCase()]).padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return null;
}
// "Check-out Sun 18 Oct 2026" or "Check-out: 2026-10-18" in any attached document
export function checkoutDateFrom(documents) {
  for (const d of documents) {
    const m = (d.text || '').match(/check-?out[^\n]*/i);
    if (!m) continue;
    const iso = toIso(m[0]);
    if (iso) return iso;
  }
  return null;
}

// Rules the consulate would apply. Each returns null, or
// { severity: 'error' | 'warning', finding }. Errors block submission.
const err = (finding) => ({ severity: 'error', finding });
const warn = (finding) => ({ severity: 'warning', finding });

export const RULES = [
  {
    id: 'R1', title: 'Names must match the passport exactly',
    check: (f, s) => {
      const mrz = passportNamesFrom(s.documents);
      if (!mrz) return null; // no machine-readable passport among the documents
      const bad = [];
      if (f.givenNames && f.givenNames.trim().toUpperCase() !== mrz.given) bad.push(`given names "${f.givenNames}" vs passport "${mrz.given}"`);
      if (f.surname && f.surname.trim().toUpperCase() !== mrz.surname) bad.push(`surname "${f.surname}" vs passport "${mrz.surname}"`);
      return bad.length ? err(`Consulates compare the form against the passport's machine-readable zone. Mismatch: ${bad.join('; ')}. Use the passport spelling and put other spellings under 2.3 "Other names used".`) : null;
    }
  },
  {
    id: 'R2', title: 'Passport valid six months beyond departure',
    check: (f) => {
      if (!f.passportExpires || !f.departureDate) return null;
      const exp = new Date(f.passportExpires), dep = new Date(f.departureDate);
      const needed = new Date(dep); needed.setMonth(needed.getMonth() + 6);
      const neededIso = needed.toISOString().slice(0, 10);
      if (exp < needed) return err(`Passport expires ${f.passportExpires}, but must be valid until at least ${neededIso} (six months after ${f.departureDate}). Renew the passport before applying.`);
      const marginDays = Math.round((exp - needed) / 86400000);
      if (marginDays < 90) return warn(`Passport meets the six-month rule by only ${marginDays} days (needed ${neededIso}, expires ${f.passportExpires}). If the trip slips, this becomes a refusal. Consider renewing first.`);
      return null;
    }
  },
  {
    id: 'R3', title: 'Accommodation must cover the whole stay',
    check: (f, s) => {
      const checkout = checkoutDateFrom(s.documents.filter((d) => d.attached));
      if (!checkout || !f.departureDate) return null;
      // a second place to stay: a new line, a semicolon, or simply two street addresses
      const addr = f.usAddress || '';
      const parts = addr.split(/\n|;/).map((x) => x.trim()).filter(Boolean).length;
      const streets = (addr.match(/\d{1,5}\s+[A-Za-z][A-Za-z.'\s]*?\b(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Way|Dr|Drive|Pl|Place)\b/g) || []).length;
      const hasSecondAddress = parts > 1 || streets > 1;
      if (f.departureDate > checkout && !hasSecondAddress) return err(`Hotel confirmation ends ${checkout} but departure is ${f.departureDate}: the night of ${checkout} is unaccounted for. Extend the booking, or add the address for that night to 4.4 alongside the hotel.`);
      return null;
    }
  },
  {
    id: 'R4', title: 'Petition-based categories need a receipt number',
    check: (f) => {
      const cat = VISA_CATEGORIES.find((c) => c.code === f.visaCategory);
      if (cat?.petition && !f.petitionNumber) return err(`${cat.code} requires an approved petition. Enter the I-129 receipt number in 1.2, or choose a different category.`);
      return null;
    }
  },
  {
    id: 'R5', title: 'Security questions answered by the applicant',
    check: (f) => {
      const open = Object.entries(FIELDS).filter(([n, sp]) => sp.humanOnly && !f[n]).map(([, sp]) => sp.n);
      return open.length ? err(`Questions ${open.join(', ')} are unanswered. These must be answered personally by the applicant — an agent cannot fill them.`) : null;
    }
  },
  {
    id: 'R6', title: 'Purpose consistent with category',
    check: (f) => {
      if (f.visaCategory === 'B-1' && /tourism|vacation|holiday/i.test(f.purpose || '')) return err('Purpose describes tourism but category is B-1 (business). Choose B-2 or describe the business purpose.');
      if (f.visaCategory === 'B-2' && /conference|speaker|meeting|business/i.test(f.purpose || '')) return warn('Purpose mentions business activity but category is B-2 (tourism). Conference attendance is normally B-1.');
      return null;
    }
  }
];

export const MRV_FEE_USD = 185;

export const SLOTS = [
  { id: 'slot-1', date: '2026-09-15', time: '08:30', location: 'U.S. Embassy Kyiv — Nonimmigrant Visa Unit' },
  { id: 'slot-2', date: '2026-09-15', time: '13:45', location: 'U.S. Embassy Kyiv — Nonimmigrant Visa Unit' },
  { id: 'slot-3', date: '2026-09-23', time: '10:00', location: 'U.S. Consulate General Kraków' },
  { id: 'slot-4', date: '2026-10-01', time: '09:15', location: 'U.S. Embassy Warsaw' }
];

const listeners = new Set();
const state = {
  screen: 'category',
  fields: Object.fromEntries(Object.keys(FIELDS).map((k) => [k, ''])),
  documents: SAMPLE_DOCUMENTS.map((d) => ({ ...d, attached: false })),
  sampleLoaded: true,
  recent: {},        // field -> { source, at } for fields the agent wrote
  lastBatch: null,   // { changes: [{field, from, to, source}], note, at } for undo
  fee: null,          // { paid: true, amount, reference, at }
  interview: null,    // slot
  submission: null,   // { reference, at }
  activity: []
};

function notify() { for (const fn of listeners) fn(state); }
export function subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); }
export function getState() { return state; }

export function logActivity(kind, text) {
  state.activity.unshift({ kind, text, at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  state.activity = state.activity.slice(0, 40);
  notify();
}

export function setField(name, value, { silent } = {}) {
  if (!(name in FIELDS)) throw new Error(`Unknown field '${name}'`);
  state.fields[name] = value;
  if (!silent) notify();
}

export function goToScreen(id) {
  if (!SCREENS.some((s) => s.id === id)) throw new Error(`Unknown screen '${id}'`);
  state.screen = id;
  notify();
}

/**
 * Apply changes from the agent straight into the form. Reversible, so it does
 * not wait for approval: every changed field is highlighted with its source and
 * the whole batch can be undone. Human-only fields are refused.
 */
export function applyChanges(updates, { note, sources = {} } = {}) {
  if (state.submission) {
    throw new Error(`The application was filed as ${state.submission.reference} and can no longer be edited.`);
  }
  const applied = [], refused = [];
  const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  for (const [field, to] of Object.entries(updates)) {
    const spec = FIELDS[field];
    if (!spec) { refused.push({ field, reason: 'unknown field' }); continue; }
    if (spec.humanOnly) { refused.push({ field, reason: 'must be answered by the applicant personally' }); continue; }
    const from = state.fields[field];
    if (String(from) === String(to)) continue;
    state.fields[field] = String(to);
    state.recent[field] = { source: sources[field] || null, at };
    applied.push({ field, from, to: String(to), source: sources[field] || null });
  }
  if (applied.length) state.lastBatch = { changes: applied, note, at };
  notify();
  return { applied, refused };
}

export function undoLastBatch() {
  const batch = state.lastBatch;
  if (!batch) return 0;
  for (const { field, from } of batch.changes) {
    state.fields[field] = from;
    delete state.recent[field];
  }
  state.lastBatch = null;
  notify();
  return batch.changes.length;
}

export function clearRecent(field, { silent } = {}) {
  if (!state.recent[field]) return;
  delete state.recent[field];
  if (!silent) notify();
}

export function addDocument({ kind, text }) {
  const id = 'doc-' + Math.random().toString(36).slice(2, 8);
  state.documents.push({ id, kind: kind || 'Document', text: String(text || ''), attached: false, own: true });
  state.sampleLoaded = false;
  notify();
  return id;
}

export function removeDocument(id) {
  const i = state.documents.findIndex((d) => d.id === id && !d.editable);
  if (i === -1) return false;
  state.documents.splice(i, 1);
  notify();
  return true;
}

export function loadSampleDocuments() {
  state.documents = SAMPLE_DOCUMENTS.map((d) => ({ ...d, attached: false }));
  state.sampleLoaded = true;
  notify();
}

export function clearDocuments() {
  state.documents = state.documents.filter((d) => d.editable).map((d) => ({ ...d, text: '' }));
  state.sampleLoaded = false;
  notify();
}

export function setDocumentText(id, text, { silent } = {}) {
  const doc = state.documents.find((d) => d.id === id && d.editable);
  if (!doc) return;
  doc.text = text;
  if (!silent) notify();
}

export function attachDocument(id, attached = true) {
  const doc = state.documents.find((d) => d.id === id);
  if (!doc) throw new Error(`Unknown document '${id}'`);
  doc.attached = attached;
  notify();
  return doc;
}

export function setFee(fee) { state.fee = fee; notify(); }
export function setInterview(slot) { state.interview = slot; notify(); }
export function setSubmission(sub) { state.submission = sub; notify(); }

export function missingRequired() {
  return Object.entries(FIELDS)
    .filter(([name, sp]) => !sp.optional && !String(state.fields[name] || '').trim())
    .map(([name, sp]) => ({ name, n: sp.n, label: sp.label, screen: sp.screen }));
}

export function runRules() {
  return RULES.map((r) => ({ id: r.id, title: r.title, ...(r.check(state.fields, state) || {}) }))
    .filter((r) => r.finding);
}
export const blockingProblems = () => runRules().filter((r) => r.severity === 'error');
