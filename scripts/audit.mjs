// Self-check of the data and tool layers — runs in Node, no browser needed.
//   node scripts/audit.mjs
// Exits 1 if any check fails. Gated tools are exercised only up to the point
// where they would open the approval dialog; that part needs a browser.
import {
  FIELDS, SCREENS, VISA_CATEGORIES, SAMPLE_DOCUMENTS, RULES,
  getState, passportNamesFrom, checkoutDateFrom, applyChanges, undoLastBatch, setSubmission, missingRequired, setField, runRules
} from '../src/state.js';
import { TOOLS, ACTION_POLICY } from '../src/agent/tools.js';
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function check(id, cond, detail = '') {
  if (cond) passed++; else failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`);
}
const tool = (name) => TOOLS.find((t) => t.name === name);
// Chrome's preview passes a JSON string; the spec shows an object. Both must work.
const call = async (name, args, asString = true) => {
  const r = await tool(name).execute(asString ? JSON.stringify(args ?? {}) : args);
  const t = r.content[0].text;
  try { return JSON.parse(t); } catch { return t; }
};

console.log('— data model —');
const fields = Object.entries(FIELDS);
check('D1 field catalogue', fields.length === 42 && SCREENS.length === 9 && VISA_CATEGORIES.length === 7, `${fields.length} fields, ${SCREENS.length} screens, ${VISA_CATEGORIES.length} categories`);
const humanOnly = fields.filter(([, s]) => s.humanOnly).map(([n]) => n);
check('D2 human-only fields are the five security questions', humanOnly.length === 5 && humanOnly.every((n) => n.startsWith('sec')), humanOnly.join(','));
check('D3 seven consular rules', RULES.length === 7 && RULES.every((r) => /^R[1-7]$/.test(r.id)));

console.log('— document parsers —');
const mrz = passportNamesFrom(SAMPLE_DOCUMENTS);
check('P1 sample passport MRZ', mrz?.surname === 'KOVALENKO' && mrz?.given === 'MARIIA', JSON.stringify(mrz));
const polish = [{ text: 'PLACE OF BIRTH   KRAKOW\nP < P O L N O W A K < < J A N < T A D E U S Z < < < < < < < < < < < < < < < < < < < < < < < <\nEK4471902<2POL8811024M3301195<<<<<<<<<<<<<<04' }];
const pl = passportNamesFrom(polish);
check('P2 padded MRZ (PDF/OCR spacing) still parses', pl?.surname === 'NOWAK' && pl?.given === 'JAN TADEUSZ', JSON.stringify(pl));
check('P3 decoy line "PLACE OF BIRTH" is not an MRZ', passportNamesFrom([{ text: 'PLACE OF BIRTH KRAKOW\nPASSPORT No EK4471902' }]) === null);
check('P4 no passport among documents → rule R1 skipped', passportNamesFrom([{ text: 'Booking confirmation, no MRZ here' }]) === null);
check('P5 check-out "Sun 18 Oct 2026"', checkoutDateFrom(SAMPLE_DOCUMENTS) === '2026-10-18', checkoutDateFrom(SAMPLE_DOCUMENTS));
check('P6 check-out ISO form', checkoutDateFrom([{ text: 'Checkout: 2027-02-06, 11:00' }]) === '2027-02-06');
check('P7 no check-out date → null', checkoutDateFrom([{ text: 'Guest: Jan Nowak\nRoom 12' }]) === null);

console.log('— tools, called the way Chrome calls them (JSON-string arguments) —');
check('T1 thirteen tools', TOOLS.length === 13, TOOLS.map((t) => t.name).join(' '));
const gated = TOOLS.filter((t) => t.gated).map((t) => t.name);
check('T2 three gated tools, each description starts with the approval tag',
  gated.length === 3 && TOOLS.filter((t) => t.gated).every((t) => t.description.startsWith('[APPROVAL REQUIRED')), gated.join(','));
check('T3 policy names the same three tools', ACTION_POLICY.consequential.map((c) => c.tool).sort().join() === gated.sort().join());
const policy = await call('get-action-policy');
check('T4 get-action-policy: consequential, reversible, human-only, spec gap',
  policy.consequential?.length === 3 && policy.reversible?.tools?.includes('fill-fields') && policy.humanOnly?.fields?.length === 5 && /#165/.test(policy.howApprovalWorks));
const docs = await call('read-documents');
check('T5 read-documents returns the sample pile', docs.documents?.length === 6 && docs.documents.some((d) => d.id === 'passport') && docs.documents.some((d) => d.id === 'notes'), `${docs.documents?.length} documents`);

const fill = await call('fill-fields', {
  changes: { surname: 'KOVALENKO', givenNames: 'MARIIA', visaCategory: 'B-1', arrivalDate: '2026-10-12', departureDate: '2026-10-19', passportExpires: '2027-06-14', purpose: 'Speaker at the Salesforce Developer Summit', secArrest: 'No', bogusField: 'x' },
  sources: { surname: 'passport', givenNames: 'passport' },
  note: 'audit'
});
check('T6 fill-fields writes reversible fields immediately', fill.applied === 7 && getState().fields.surname === 'KOVALENKO', `applied ${fill.applied}`);
check('T7 fill-fields refuses a human-only field and an unknown field',
  fill.refused?.some((r) => r.field === 'secArrest' && /personally/.test(r.reason)) && fill.refused?.some((r) => r.field === 'bogusField'), JSON.stringify(fill.refused));
check('T8 written fields carry provenance and form one undoable batch',
  getState().recent.surname?.source === 'passport' && getState().lastBatch?.changes.length === 7);
const fillObj = await call('fill-fields', { changes: { email: 'maria.kovalenko@example.com' } }, false);
check('T9 object arguments (spec style) work too', fillObj.applied === 1);

const att = await call('attach-document', { documentId: 'hotel', attached: true });
check('T10 attach-document', att.attached === true && getState().documents.find((d) => d.id === 'hotel').attached);
const attBad = await call('attach-document', { documentId: 'nope', attached: true });
check('T11 attach-document refuses an unknown id', attBad.refused === true, attBad.reason);

let v = await call('validate-application');
const ruleIds = (list) => (list || []).map((x) => x.rule.split(' ')[0]);
check('V1 validation is not ok while problems remain', v.ok === false);
check('V2 R3 blocks: hotel ends 18 Oct, departure 19 Oct', ruleIds(v.blocking).includes('R3'), JSON.stringify(v.blocking?.find((b) => b.rule.startsWith('R3'))?.finding));
check('V3 R5 blocks: security questions unanswered', ruleIds(v.blocking).includes('R5'));
check('V4 R2 is advisory: passport expires 56 days past the six-month line', ruleIds(v.advisory).includes('R2'));
check('V5 R1 silent while names match the passport', !ruleIds(v.blocking).includes('R1'));
check('V6 missing required fields reported', v.missingRequired?.length > 0 && v.missingRequired.length === missingRequired().length, `${v.missingRequired?.length} missing`);

await call('fill-fields', { changes: { givenNames: 'Maria' } });
v = await call('validate-application');
check('V7 R1 fires on "Maria" vs passport "MARIIA"', ruleIds(v.blocking).includes('R1'), v.blocking?.find((b) => b.rule.startsWith('R1'))?.finding?.slice(0, 120));
const undo = await call('undo-last-changes');
check('V8 undo restores the passport spelling', /Reverted 1/.test(undo) && getState().fields.givenNames === 'MARIIA', String(undo));

console.log('— gated tools: everything before the dialog —');
const sched = await call('schedule-interview', { slotId: 'anything' });
check('G1 schedule-interview refuses before the fee is paid, without opening a dialog', sched.blocked === true && /fee/i.test(sched.reason));
const sub = await call('submit-application');
check('G2 submit-application refuses while blocked (validation, missing fields, fee, interview)', sub.blocked === true && /fee not paid/.test(sub.reason) && /no interview/.test(sub.reason), sub.reason);
const pay = await call('pay-mrv-fee');
check('G3 pay-mrv-fee cannot complete without the page: it opens the dialog (DOM) — in Node that is a refusal, not a payment', pay.refused === true && /document/.test(pay.reason), pay.reason);
const toolsSource = readFileSync(new URL('../src/agent/tools.js', import.meta.url), 'utf8');
check('G4 pay-mrv-fee is not blocked by validation problems — it names them in the dialog and the button says "anyway"; the applicant decides',
  /label: 'Open issues'/.test(toolsSource) && /anyway/.test(toolsSource) && !/blockingProblems\(\)\.length\) return text/.test(toolsSource.split("name: 'pay-mrv-fee'")[1].split("name: 'schedule-interview'")[0]));

console.log('— values the form cannot show are refused —');
const bad = await call('fill-fields', { changes: { departureDate: '19/10/2026', sex: 'female', travelledBefore: 'nope', monthlyIncome: 'UAH 132,000', contactPhone: null, constructor: 'x' } });
check('W1 day-first date refused with a reason', bad.refused?.some((r) => r.field === 'departureDate' && /YYYY-MM-DD/.test(r.reason)));
check('W2 enum normalised to its option (female → Female)', getState().fields.sex === 'Female');
check('W3 yesno outside Yes/No refused', bad.refused?.some((r) => r.field === 'travelledBefore'));
check('W4 "UAH 132,000" becomes 132000', getState().fields.monthlyIncome === '132000');
check('W5 null and prototype names refused', bad.refused?.some((r) => r.field === 'contactPhone') && bad.refused?.some((r) => r.field === 'constructor'), JSON.stringify(bad.refused?.map((r) => r.field)));
const gts = await call('go-to-screen', { screen: 'nowhere' });
check('W6 go-to-screen with an unknown screen is a refusal, not a throw', gts.refused === true);
const nul = (await tool('fill-fields').execute('null')).content[0].text;
check('W7 the argument string "null" is treated as no arguments', /No changes supplied/.test(nul), nul.slice(0, 60));
await call('undo-last-changes');
check('W8 R2 is computed in UTC: departure 2026-07-01, expiry 2027-01-01 is a 0-day warning in every timezone',
  (() => { const s = getState(); s.fields.departureDate = '2026-07-01'; s.fields.passportExpires = '2027-01-01'; const r = runRules().find((x) => x.id === 'R2'); s.fields.departureDate = '2026-10-19'; s.fields.passportExpires = '2027-06-14'; return r?.severity === 'warning' && /only 0 days/.test(r.finding); })());
check('W9 R7 flags departure before arrival', (() => { const s = getState(); s.fields.arrivalDate = '2026-10-20'; const r = runRules().find((x) => x.id === 'R7'); s.fields.arrivalDate = '2026-10-12'; return r?.severity === 'error'; })());
check('W10 latest check-out wins with two hotels', checkoutDateFrom([{ text: 'Check-out: Oct 15, 2026' }, { text: 'Check-out Sunday, October 18, 2026' }]) === '2026-10-18');
check('W11 German-style MRZ (P<D<<) parses', passportNamesFrom([{ text: 'P<D<<MUSTERMANN<<ERIKA<<<<<<<<<<<<<<<<<<<<<<<<<\nC01X00T478D<<6408125F2702283<<<<<<<<<<<<<<<4' }])?.surname === 'MUSTERMANN');

console.log('— after filing —');
setSubmission({ reference: 'AUDIT-TEST', at: new Date().toISOString() });
const late = await call('fill-fields', { changes: { email: 'x@y.z' } });
check('S1 no edits after filing', late.refused === true && /filed/.test(late.reason), late.reason);
let threw = false; try { applyChanges({ email: 'a@b.c' }); } catch { threw = true; }
check('S2 the state layer itself refuses, not just the tool', threw);
const lateUndo = await call('undo-last-changes');
check('S3 undo refused after filing', lateUndo.refused === true, JSON.stringify(lateUndo).slice(0, 80));
const lateAttach = await call('attach-document', { documentId: 'hotel', attached: false });
check('S4 attach/detach refused after filing', lateAttach.refused === true && getState().documents.find((d) => d.id === 'hotel').attached === true);
const lateSched = await call('schedule-interview', { slotId: 'slot-1' });
check('S5 rescheduling refused after filing', lateSched.blocked === true || lateSched.refused === true, lateSched.reason);
let uiThrew = false; try { setField('email', 'ui@edit.test'); } catch { uiThrew = true; }
check('S6 the form input path refuses too', uiThrew && getState().fields.email !== 'ui@edit.test');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
