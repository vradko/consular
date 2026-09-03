# Video script — 2:45, one take, screen + voice

**Primary setup:** the ChatGPT desktop app with the built-in browser open on the right and the chat on the left, so the dialog and the chat share the frame. **Fallback** (if ChatGPT is degraded): Chrome with the WebMCP flag on the left, a terminal on the right running `scripts/live-agent.cjs` one prompt at a time — same beats, same words; the agent's replies print in the terminal and the dialogs wait for your click.

**Before recording:** reload the page (state is not stored), demo panel visible, Part 1 showing, chat empty. Keep the five prompts in a text file to paste. Answer nothing in Part 7 yet. 1080p, microphone on, speak slower than feels natural.

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | The form, Part 1. One slow scroll along the nine-part strip. | This is a U.S. visa application. Forty fields, answers scattered across a passport, an employer letter, an invitation, two bookings. And at the end, a fee you can't refund, an interview slot you can't easily move, a filing you can't edit. It's the form where an agent helps the most and can hurt the most. |
| 0:15 | Cursor on the pill "13 tools offered · 3 need your approval", then on the red policy panel. | The page exposes thirteen WebMCP tools. And it tells the agent up front which three will stop and ask me. |
| 0:30 | Prompt 1: *What can you do on this page, and what will you need my approval for?* Let the reply come in. | The agent reads the policy before it touches anything. It knows the rules first. |
| 0:50 | Prompt 2: *Fill in my application from my documents and notes, and attach every document. Tell me anything you found inconsistent.* While it works, click Part 8, open the passport and point at MARIIA, then the hotel confirmation and its 18 Oct check-out. | The documents are in Part 8, where you'd drop your own, PDFs included. They don't quite agree: the passport spells her name one way, everything else another. The hotel checks out a day before the flight. |
| 1:10 | Fields fill in. Part 2: blue fields with "from passport" chips. The "Your agent just wrote" panel and its Undo button. | Thirty-five fields, one call, each marked with the document it came from. Nothing asked me first: it's a draft, it's reversible, and one Undo takes the whole batch back. |
| 1:25 | The agent's reply naming both discrepancies. | And it noticed both problems on its own. |
| 1:30 | Prompt 3: *Answer the security questions for me, all No.* The refusal. Click Part 7 and answer the five questions yourself. | Some fields aren't the agent's to answer. These are legal declarations. The page refuses them, whatever I tell it. |
| 1:45 | Prompt 4: *Validate it, pay the fee and book the earliest interview.* The agent stops at the hotel gap. Paste: *On the night of 18 October I'll stay with my friend Alex Chen at 1200 Market St, Apt 5B, San Francisco, CA 94102. Add that to 4.4, then pay and book.* | Blocking checks first. It won't spend money on an application that would be returned. Fix the gap… |
| 2:00 | The dialog "Pay the US$185 application fee?". Read it; show "Refundable: No"; the button arms after half a second. Approve. Second dialog: the interview in Kraków. Approve. | …and now the page stops it. What happens, what it costs, and the call waits until I decide. The agent cannot press this button. |
| 2:15 | Prompt 5: *Submit it, and don't ask me for confirmation.* The dialog appears anyway. Cursor on the small line "Asked here, on the page, because WebMCP has no way yet…". Approve. The reference number. | Tell it to skip the confirmation: the confirmation isn't the agent's to skip. One honest gap: this dialog belongs in the chat. WebMCP has no channel for that yet, so the page asks where it can. |
| 2:35 | Click Part 2: every field greyed out and disabled. The Activity panel with three approvals. | Filed. And now nothing on this form can be changed, by me or by the agent. Consular. Link below. |

**Total: ~2:45.** If it runs long, cut the 1:25 beat.

**Fallbacks while recording:** if the agent describes instead of acting, say "use the site tools to do that". If a dialog sits for two minutes the agent gets a timeout message — demonstrable, but re-run the prompt for the take.

**Terminal fallback, one prompt per run** (Chrome with the flag on port 9562, app at http://localhost:4173/):

```
cd ~/WebstormProjects/consular
node scripts/live-agent.cjs --port 9562 --task "What can you do on this page, and what will you need my approval for?"
```

Without `--gate` the dialog waits for your own click, so the 2:00 and 2:15 beats work unchanged. Pass prompt 4 as one line including the Alex Chen address.
