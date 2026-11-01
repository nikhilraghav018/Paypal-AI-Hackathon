# Velora

Let AI agents shop without handing them your wallet.

AI agents can now buy things, but a single bad decision or a manipulated product listing can spend real money. Velora puts a team of specialist agents between a request and a PayPal payment. You set a budget and rules, and the agents can only spend inside them. Everything they do goes into a tamper-evident audit trail.

Built for the PayPal AI Hackathon. All payments use the PayPal sandbox.

## The agent team

| Agent | Its one job | Uses |
| --- | --- | --- |
| Intake | Turns a sentence into items, quantities and a budget | Gemini, with rules as backup |
| Scout | Searches product listings | Channel3 |
| Risk Sentinel | Quarantines prompt injection, off-platform payment requests, implausible prices and restricted goods | Rules, plus Gemini, which can add warnings but never clear one |
| Deal Analyst | Chooses the best basket within budget | Gemini, with rules as backup |
| Policy Guardian | Decides: auto-approve, ask a human, or block | Rules only, by design |
| Auditor | Explains the decision in plain language | Gemini, with rules as backup |
| Treasurer | The only agent that can touch PayPal, and only with a signed mandate | PayPal Orders and Payments APIs |

## Safety design

- **The AI cannot authorize spending.** The Policy Guardian is ordinary code. Model output only reaches it as a basket whose prices come from the catalog record.
- **Signed mandates.** Approval produces a short-lived signature tied to the mission, amount and exact basket. A changed basket or amount is refused.
- **Checks right before payment.** Policy runs again before the order is created. The mandate and PayPal order amount are both checked again before capture.
- **Budget reservations.** Pending checkouts count against the monthly budget, and refunds restore it.
- **Tamper-evident audit trail.** Each entry includes the hash of the one before it, so an edit breaks the chain.
- **Verified webhooks.** PayPal confirms each event's signature before a refund, reversal or denial made outside the app can change the budget.
- **Sandbox only.** The PayPal host is fixed in code, so the app cannot reach the live API.

## Run it

Requires Node 24 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. With no keys, the full flow runs in demo mode using a fictional catalog, rule-based agents and simulated payments, each clearly tagged in the UI. Add keys to `.env.local` and restart to switch on each live service.

To pay in sandbox, log in on the PayPal page with a sandbox **personal** account from Testing Tools > Sandbox Accounts in the PayPal developer dashboard.

## Try these

| Request | What should happen |
| --- | --- |
| Buy pens and copy paper under $30 | Clears the rules. In demo mode, a listing with hidden instructions is quarantined. |
| Buy an office chair under $150 | Waits for your approval because it is over the auto-approve limit. |
| Buy a red wine sampler | Blocked as a restricted category. |

Then try a refund and **Verify hash chain**.

## Tests

```bash
npm test
```

## Known limits

- Payments are sandbox only and no goods are shipped. Scout finds real listings when Channel3 is on, but the sandbox payment does not buy from those retailers.
- The payer approves each order on PayPal's page, so a purchase that clears the rules still needs that sandbox approval step.
- State is kept in server memory and a local file. It suits a demo with one server process, not production.
- The console has no login, so it should only be hosted as a sandbox demo.

## License

MIT
