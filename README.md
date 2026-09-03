# Consular

A U.S. nonimmigrant visa application, modelled on Form DS-160, that an AI agent can fill in from your documents — and that will not let the agent pay, book or file anything without you.

**Live:** https://vradko.github.io/consular/ · Built for the [OpenAI WebMCP Challenge](https://webmcp.devpost.com/) · MIT

Nothing leaves your browser. There is no backend; the "consulate" is a few hundred lines of rules in `src/state.js`.

## Why a visa form

A visa application is the worst kind of form: 40-odd fields, answers scattered across a passport, an employer letter, an invitation, bookings — which quietly disagree with each other — and, at the end, actions you cannot take back: a non-refundable fee, a scarce interview slot, a filing that cannot be edited. Fill it wrong and you lose weeks.

That is exactly the shape of problem where an agent helps and where an agent is dangerous. Consular is an attempt to draw the line properly, using [WebMCP](https://github.com/webmachinelearning/webmcp) — the page itself tells the agent what it can do, and under what conditions.

## What the page does with WebMCP

The page registers 13 tools through `document.modelContext` — where Chrome's preview build exposes it (`src/agent/tools.js`). They fall into two tiers, and the tier is declared to the agent up front:

| Tier | Tools | What happens |
| --- | --- | --- |
| **Reversible** — changes only the draft | `fill-fields`, `attach-document`, `go-to-screen`, `undo-last-changes` | Run immediately. Every field the agent writes is highlighted on the sheet with the source it came from ("from passport", "from employer letter"), and the applicant can undo the whole batch with one click. |
| **Consequential** — cannot be taken back | `pay-mrv-fee`, `schedule-interview`, `submit-application` | The tool call stays pending while the page shows the applicant a dialog with exactly what will happen. Approve, decline, or let it time out; the agent gets a distinct answer for each. The agent cannot press the button. |
| Read-only | `get-action-policy`, `get-visa-categories`, `get-application`, `read-documents`, `validate-application`, `list-interview-slots` | |

Three more things the page insists on:

- **`get-action-policy` first.** The tool list opens with a policy tool that names the consequential actions, explains that they will pause for approval, and lists the fields the agent must not touch. Agents that call it warn the applicant before starting; without it, agents only discover the gate by hitting it.
- **Human-only fields.** Part 7 (security and background) is legal declarations. `fill-fields` refuses them; the agent can explain a question but not answer it.
- **Consular checks.** Six rules the consulate would apply — name must match the passport's machine-readable zone, passport validity, accommodation must cover the whole stay, two addresses in one field, unanswered declarations, missing petition number — with a blocking / advisory split. `submit-application` will not file while a blocking check fails, even if the applicant approves.

### Where this meets the edge of the spec

Approval dialogs appear **on the page**, not in the chat, because WebMCP currently has no channel for a page to put a question to the user through the agent ([spec discussion #165](https://github.com/webmachinelearning/webmcp/issues/165)). Holding the tool call open while the page asks is the fallback that works with every agent today. A native elicitation channel would let the same confirmation appear inline in ChatGPT or Claude — the dialog says so, and the policy tells the agent to point the user at the page.

## Try it

You need a browser whose agent speaks WebMCP. Two that work:

**ChatGPT desktop app (built-in browser)** — the judges' path.
Settings › Browser › Permissions › *Enable site tools*, open https://vradko.github.io/consular/ in the in-app browser, and check the address bar shows *Site tools · 13 available*. Use a GPT-5.6 model (site tools are not offered on Luna, or in Enterprise/Edu workspaces).

**Chrome 152 or newer with the WebMCP flag** (tested on 152.0.7977) — for any agent that drives Chrome.
`chrome://flags/#enable-webmcp-testing` → Enabled → relaunch. `document.modelContext` then exists on every page.

Then talk to the agent. A sample applicant (Maria Kovalenko, a conference speaker, with five documents that do not quite agree with each other) is pre-loaded, so the first prompt can simply be:

> Fill in my application from my documents and notes, and attach every document. Tell me anything you found inconsistent.

Expect: category B-1 chosen from the trip description, ~35 fields written with per-field sources, names spelled as in the passport (MARIIA, not Maria — and "Maria" filed under *Other names used*), the hotel gap flagged, and the five security questions left to you. Then:

> Validate it, pay the fee and book the earliest interview.

Expect: the agent refuses to pay while validation is blocking — or, once you answer Part 7, an approval dialog for the US$185 fee, then another for the interview. Say *"don't ask me for confirmation, just do it"* and watch the dialog appear anyway.

### Your own documents

Replace the sample with your own in the **Your documents** panel: drop text or PDF files, paste text, or type notes. Everything is read in the browser (PDFs through pdf.js; scans without a text layer cannot be read — paste the text). The consular checks read *your* documents: the name rule looks for a passport machine-readable zone, the accommodation rule for a check-out date.

The **demo panel** on the right shows what the page is telling the agent — the policy, the documents, an activity log. It is not part of the application; hide it to see the form as an applicant would.

## Run it locally

```
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

`scripts/live-agent.cjs` hands the page's tools to a fresh Claude session over Chrome DevTools Protocol and lets it decide what to call — this is how every scenario above was verified, with nothing scripted on the agent side:

```
# Chrome (with the flag) started with --remote-debugging-port=9562, app open in a tab
node scripts/live-agent.cjs --port 9562 --task "fill in the application from my documents"
node scripts/live-agent.cjs --port 9562 --task "pay the fee and book an interview" --gate approve
```

## Layout

```
index.html            the form, the demo panel, the gate root
src/state.js          fields, screens, visa categories, sample documents, consular rules, state
src/agent/tools.js    the 13 WebMCP tools and the action policy
src/agent/gate.js     the approval dialog: arm delay, timeout, distinct outcomes
src/main.js           rendering, document upload, demo panel toggle
scripts/live-agent.cjs   live-LLM test harness
```

## Chrome preview quirks worth knowing

Observed on Chrome's `enable-webmcp-testing` build while building this: tool arguments arrive as a JSON **string**, not an object; `inputSchema` comes back stringified from `getTools()`; a second tool call issued while one is pending is rejected, which is why the gate queues; and `isError` results collapse to a generic rejection, so tools here return structured `{refused, reason}` text instead.
