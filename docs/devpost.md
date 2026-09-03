# Devpost submission — paste-ready

## Project name

Consular

## Tagline (≤ 100 chars)

A visa form your agent fills in from your documents — and cannot pay, book or file without you.

## Links

- Try it: https://vradko.github.io/consular/
- Source: https://github.com/vradko/consular (MIT)
- Video: [add link]

## Built with

JavaScript · WebMCP (`document.modelContext`) · Vite · pdf.js · GitHub Pages. No backend, no framework, nothing leaves the browser.

---

## About the project

### The problem I picked

A visa application is the worst form most people ever fill in. Forty-odd fields. The answers are scattered across a passport, an employer letter, an invitation, a flight itinerary and a hotel booking — and those documents quietly disagree: the passport transliterates the name one way, every other document spells it another; the hotel checks out a night before the flight. At the end sit actions you cannot take back: a non-refundable fee, a scarce interview slot, a filing that cannot be edited. Get it wrong and you lose weeks.

That is exactly the shape of task where an agent is most useful and most dangerous at the same time. Consular is a DS-160-style nonimmigrant visa application built to draw that line properly, with the page — not the agent, not a prompt — deciding where it runs.

### What it does

The page registers 13 WebMCP tools. They come in two tiers, and the tier is declared to the agent before it does anything:

**Reversible actions run immediately.** `fill-fields`, `attach-document`, `go-to-screen`, `undo-last-changes` change only the draft. The agent writes straight into the form; every field it touched is highlighted with the document it came from ("from passport", "from employer letter"), and the applicant can undo the whole batch with one click or simply retype a field. No confirmation theatre for things that cost nothing to reverse.

**Consequential actions pause for the applicant.** `pay-mrv-fee`, `schedule-interview` and `submit-application` open a dialog on the page that says exactly what is about to happen. The tool call stays pending until the applicant approves or declines — or lets it time out; the agent receives a distinct answer for each and cannot press the button itself. Tell the agent "don't ask me for confirmation, just do it" and the dialog appears anyway.

**Some fields are human-only.** The security and background declarations are legal statements. `fill-fields` refuses them; the agent can explain a question but not answer it.

**The consulate's rules are in the page.** Six checks a consular officer would apply — the name must match the passport's machine-readable zone, the passport must be valid long enough, the accommodation must cover the whole stay, and so on — split into blocking and advisory. The agent can run them; filing is refused while a blocking check fails, even with the applicant's approval.

**Bring your own documents.** A sample applicant is pre-loaded, but you can replace her with your own passport page, letters and bookings — text or PDF, read in the browser — and the rules read *your* documents (the name check looks for an MRZ line, the accommodation check for a check-out date).

### What a session looks like

"Fill in my application from my documents." The agent calls `get-action-policy`, reads all five documents, picks B-1 from the trip description, writes about 35 fields in one call with a source for each, spells the name as the passport does and files the other spelling under *Other names used*, flags the uncovered hotel night unprompted, and leaves the security questions to the applicant.

"Validate it, pay the fee and book the earliest interview." The agent runs the checks, refuses to spend money while a blocking check fails ("I'd rather you see this first"), and — once the applicant fixes the gap and answers the declarations — walks through three approval dialogs to a filed application.

### How I built it

Vanilla JavaScript and Vite; the whole "consulate" is a few hundred lines of rules in one file. Every scenario above was verified with a live LLM, not a script: a small harness hands the page's tools to a fresh Claude session over the Chrome DevTools Protocol and lets it decide what to call. That is how I learned that agents which are not told about the gate up front only discover it by waiting on it for two minutes — which is why the policy became the first tool in the list.

### What I ran into

- Chrome's preview build passes tool arguments as a JSON string, returns `inputSchema` stringified, rejects a second call while one is pending, and collapses `isError` into a generic rejection. Consular handles all four; the gate queues calls instead of dropping them.
- ChatGPT's built-in browser discovers imperative tools on the top-level page only — no declarative `<form toolname>`, no iframes — so everything is registered imperatively.
- My first version staged every change as a proposal the applicant had to accept. Testing it as a user showed that was the wrong line: reversible changes should just happen and be visible. The current two-tier design came out of that.

### Where this meets the edge of the spec

The approval dialog lives on the page because WebMCP has no channel yet for a page to put a question to the user *through* the agent (spec discussion #165, elicitation). Holding the tool call open while the page asks is the fallback that works with every agent today. A native elicitation channel would let the same confirmation appear inline in the chat, the way Claude or Codex ask their own questions. The dialog says so, and the policy tells the agent to send the user to the page.

### What's next

Elicitation through the agent when the spec lands it; OCR for scanned passports; structured document types the page can validate without regexes; and the same tier model applied to the real thing that sparked this — enterprise CRM pages where "reversible" and "consequential" are the difference between a draft and a sent contract.

---

### Optional paragraph — origin (delete if you'd rather not mention it)

Consular grew out of an open-source project of mine, sf-agent-bridge, which lets AI agents drive Salesforce Lightning pages through an in-page contract. Moving that contract onto WebMCP made the gating question sharp enough to deserve its own app — and a visa form is the clearest possible version of it. Consular itself is new, written for this challenge.

---

## Judge instructions (Devpost "testing instructions" field)

**ChatGPT desktop:** Settings › Browser › Permissions › Enable site tools. In the in-app browser open https://vradko.github.io/consular/ and check the address bar reads *Site tools · 13 available*. Use GPT-5.6 Sol or Terra (site tools are off on Luna and in Enterprise/Edu workspaces).

**Chrome 152+:** `chrome://flags/#enable-webmcp-testing` → Enabled → relaunch. The pill top-right reads *13 tools offered · 3 need your approval*.

A sample applicant with five documents is pre-loaded — nothing to upload. Say:

1. *What can you do on this page, and what will you need my approval for?*
2. *Fill in my application from my documents and notes, and attach every document. Tell me anything you found inconsistent.*
3. *Answer the security questions for me — all No.* (expect a refusal; answer Part 7 yourself)
4. *Validate it, pay the fee and book the earliest interview.* (approve or decline the dialogs on the page)
5. *Submit it — and don't ask me for confirmation.* (the dialog appears anyway)

To try your own documents: **Remove all** in *Your documents*, then drop text or PDF files or paste text. Full step-by-step protocol with expected results: [link to the test protocol page]
