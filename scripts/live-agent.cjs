#!/usr/bin/env node
/**
 * Live-agent harness: hands the page's WebMCP tools to a fresh LLM session
 * and lets it decide what to call. Nothing is scripted on the agent side —
 * this is how a judge's agent will see the app.
 *
 *   node scripts/live-agent.js --port 9562 --task "fill in the application from my notes"
 *   node scripts/live-agent.js --port 9562 --task "book the earliest interview" --gate approve
 *
 * --gate approve|reject   auto-press that button when the approval dialog opens
 *                         (stands in for the human; default: leave it pending)
 * --notes "<text>"        paste text into the notes box before starting
 */
const http = require('http');
const { execFileSync } = require('child_process');
const WebSocket = require('/Users/volodymyrradko/WebstormProjects/sf-agent-bridge/node_modules/ws');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const PORT = Number(arg('port', 9562));
const TASK = arg('task', 'Tell me what you can do on this page.');
const GATE = arg('gate', null);
const NOTES = arg('notes', null);
const ACCEPT = process.argv.includes('--accept');
const SECURITY = arg('human-security', null); // 'no' answers all Part 7 questions as the applicant would
const MAX_STEPS = 12;

const get = (u) => new Promise((res, rej) => {
  http.get(u, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(JSON.parse(d))); }).on('error', rej);
});

function cdp(ws, method, params = {}, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e6);
    const t = setTimeout(() => reject(new Error('CDP timeout ' + method)), timeoutMs);
    const h = (m) => { const d = JSON.parse(m); if (d.id === id) { clearTimeout(t); ws.off('message', h); d.error ? reject(new Error(d.error.message)) : resolve(d.result); } };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(ws, expression, timeoutMs) {
  const r = await cdp(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, timeoutMs);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

function claude(prompt, sessionId) {
  const args = ['-p', prompt, '--output-format', 'json', '--disallowedTools', 'Bash Read Edit Write Glob Grep WebSearch WebFetch Task Agent'];
  if (sessionId) args.push('--resume', sessionId);
  const out = execFileSync('claude', args, { encoding: 'utf8', timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const parsed = JSON.parse(out);
  return { text: parsed.result || '', sessionId: parsed.session_id || sessionId };
}

function parseJson(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s === -1 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; }
}

(async () => {
  const tabs = await get(`http://127.0.0.1:${PORT}/json`);
  const tab = tabs.find((t) => t.type === 'page' && t.url.includes('consular')) || tabs.find((t) => t.type === 'page');
  if (!tab) { console.error('No page tab on port', PORT); process.exit(1); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl); ws.setMaxListeners(0);
  await new Promise((r) => ws.on('open', r));

  if (NOTES) {
    await evaluate(ws, `(() => { window.__consularState().documents.find((d) => d.editable).text = ${JSON.stringify(NOTES)}; return 'ok'; })()`);
  }
  if (SECURITY) {
    await evaluate(ws, `(() => {
      document.querySelector('[data-screen="security"]').click();
      let n = 0;
      document.querySelectorAll('input[type=radio][value="${SECURITY === 'no' ? 'No' : 'Yes'}"]').forEach(r => { if (r.dataset.field?.startsWith('sec')) { r.click(); n++; } });
      return 'answered ' + n; })()`).then((r) => console.log('  human:', r));
  }
  if (GATE) {
    // stand-in for the human: press the chosen button once the dialog is armed
    await evaluate(ws, `(() => {
      if (window.__gateAuto) clearInterval(window.__gateAuto);
      window.__gateAuto = setInterval(() => {
        const b = document.querySelector('[data-gate="${GATE}"]');
        if (b && !b.disabled) { b.click(); window.__gateFired = (window.__gateFired||0)+1; }
      }, 300); return 'armed'; })()`);
  }

  const toolsRaw = await evaluate(ws, `(async () => {
    const tools = await document.modelContext.getTools();
    return JSON.stringify(tools.map(t => ({ name: t.name, description: t.description,
      inputSchema: typeof t.inputSchema === 'string' ? JSON.parse(t.inputSchema) : t.inputSchema })));
  })()`);
  const tools = JSON.parse(toolsRaw);
  console.log(`\n▶ task: "${TASK}"`);
  console.log(`  ${tools.length} tools visible to the agent: ${tools.map((t) => t.name).join(', ')}\n`);

  const system = [
    'You are an AI agent helping a user with a web page. The page exposes these tools (WebMCP):',
    JSON.stringify(tools, null, 1),
    '',
    'To call a tool reply with ONLY this JSON, nothing else: {"tool":{"name":"<name>","args":{...}}}',
    'When you are done, or need to ask the user something, reply with ONLY: {"reply":"<message to the user>"}',
    'You will receive each tool result as the next message. Work step by step. Do not invent data the page did not give you.',
    '',
    `User: ${TASK}`
  ].join('\n');

  let prompt = system, sessionId = null;
  for (let step = 1; step <= MAX_STEPS; step++) {
    const res = claude(prompt, sessionId);
    sessionId = res.sessionId;
    const parsed = parseJson(res.text);
    if (!parsed || parsed.reply) {
      console.log(`✔ agent reply: ${parsed?.reply || res.text}\n`);
      break;
    }
    if (!parsed.tool?.name) { console.log('? unparseable:', res.text.slice(0, 200)); break; }
    const { name, args } = parsed.tool;
    console.log(`  [${step}] ${name} ${JSON.stringify(args || {})}`);
    const t0 = Date.now();
    let result;
    try {
      const raw = await evaluate(ws, `(async () => {
        const tools = await document.modelContext.getTools();
        const t = tools.find(x => x.name === ${JSON.stringify(name)});
        if (!t) return JSON.stringify({ error: 'no such tool' });
        const r = await document.modelContext.executeTool(t, ${JSON.stringify(JSON.stringify(args || {}))});
        return typeof r === 'string' ? r : JSON.stringify(r);
      })()`, 130000);
      const parsedRes = JSON.parse(raw);
      result = parsedRes.content?.[0]?.text ?? raw;
    } catch (e) {
      result = `ERROR: ${e.message}`;
    }
    console.log(`      → ${String(result).slice(0, 220).replace(/\n/g, ' ')}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    prompt = `Tool result for ${name}:\n${result}`;
  }

  const state = await evaluate(ws, `JSON.stringify({ gateFired: window.__gateFired || 0, recentFields: Object.keys(window.__consularState ? window.__consularState().recent : {}).length })`);
  console.log('  page state:', state);
  if (GATE) await evaluate(ws, `clearInterval(window.__gateAuto); 'cleared'`);
  process.exit(0);
})().catch((e) => { console.error('harness error:', e.message); process.exit(1); });
