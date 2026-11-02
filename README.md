# Velora

Let AI agents shop without handing them your wallet.

AI agents can now buy things, but a single bad decision or a manipulated product listing can spend real money. Velora puts a team of specialist agents between a request and a PayPal payment. You set a budget and rules, and the agents can only spend inside them. Everything they do goes into a tamper-evident audit trail.

Built for the PayPal AI Hackathon. All payments use the PayPal sandbox.

## Who it is for

People and small teams who want an AI agent to handle routine shopping, but won't hand it a payment method with no limits. Today the choice is to approve every purchase yourself, which removes the point of an agent, or to trust it completely. Velora adds a middle option: small, clean purchases happen on their own, bigger ones ask you first, and anything unsafe is stopped, with a record of why.

## What it does

- **Ask in plain language.** "Blue men's running shoes under $60" becomes items, a budget and preferences. You can also set gender, age group, colour and condition from a menu.
- **Real products.** Scout searches live listings and drops anything that is not really what you asked for.
- **Explore and choose.** Compare every screened option for an item, and switch to another. Limits are checked again and a new order is created.
- **Agent autopay.** Save a PayPal sandbox account once, and agents can pay by themselves when every check passes. Bigger purchases still wait for you, and autopay can be turned off at any time.
- **Cart.** Add products from several missions, change quantities, and pay for everything in one PayPal order with estimated tax.
- **Refunds and history.** Refund a purchase to restore the budget, and see every mission on the All missions page.
- **Safety test.** Plant a fake scam listing from the Customize menu and watch the Risk Sentinel catch it. It is the cheapest option, so it would win if it got through.

## The agent team

| Agent | Its one job | Uses |
| --- | --- | --- |
| Intake | Turns a sentence into items, quantities and a budget | Gemini, with rules as backup |
| Scout | Searches product listings | Channel3 |
| Risk Sentinel | Quarantines prompt injection, off-platform payment requests, implausible prices and restricted goods | Rules, plus Gemini, which can add warnings but never clear one |
| Deal Analyst | Chooses the best basket within budget | Gemini, with rules as backup |
| Policy Guardian | Decides: auto-approve, ask a human, or block | Rules only, by design |
| Auditor | Explains the decision in plain language | Gemini, with rules as backup |
| Treasurer | The only agent that can touch PayPal, and only with a signed mandate | PayPal Orders, Payments and Vault APIs |

## Safety design

- **The AI cannot authorize spending.** The Policy Guardian is ordinary code. Model output only reaches it as a basket whose prices come from the catalog record.
- **Signed mandates.** Approval produces a short-lived signature tied to the mission, amount and exact basket. A changed basket or amount is refused.
- **Checks right before payment.** Policy runs again before the order is created. The mandate and PayPal order amount are both checked again before capture.
- **Budget reservations.** Pending checkouts count against the monthly budget, and refunds restore it.
- **Tamper-evident audit trail.** Each entry includes the hash of the one before it, so an edit breaks the chain.
- **Verified webhooks.** PayPal confirms each event's signature before a refund, reversal or denial made outside the app can change the budget.
- **Sandbox only.** The PayPal host is fixed in code, so the app cannot reach the live API.

## How PayPal is used

| PayPal capability | What it does here |
| --- | --- |
| Orders v2: create, get, capture | Each purchase is one order with itemised lines and a tax breakdown. Its amount is checked against the signed mandate before capture. |
| Vault v3: setup and payment tokens | The owner approves once on PayPal's page, then agents can pay with the saved account. |
| Payments v2: refund | Refunds a capture and restores the budget. |
| Webhooks and signature verification | Refunds, reversals and denials made outside the app update the budget, but only after PayPal verifies the event. |
| Request IDs and debug IDs | Repeated requests can't charge twice, and PayPal's debug ID is kept with any error. |
| Declines | When PayPal declines a payment method, nothing is charged and the payer can try another. |

## PayPal Doctor review

We ran the full PayPal Doctor checklist from [PayPal's AI Toolkit](https://github.com/paypal/AI-Toolkit/blob/main/commands/doctor.md) against this code, using the toolkit's reference guides. It was run as a manual review, not through the plugin. The toolkit's sandbox connector wasn't used, so its live checks were replaced with direct calls to PayPal's sandbox.

**Result: 0 critical issues open.** Sections for features this app doesn't use (JS SDK, Pay Later, Venmo, Subscriptions) don't apply.

| Area | Result |
| --- | --- |
| Credentials | Passed. Secrets stay on the server in environment variables, and `.env*` files are ignored by git. |
| Authentication | Passed. Tokens are cached and refreshed using `expires_in`, and money-moving POST requests carry a `PayPal-Request-Id`. |
| Orders and checkout | Passed. Uses Orders v2, `INSTRUMENT_DECLINED` is handled separately, and amounts come from the server. |
| Webhooks | Passed in code and tests: signatures are verified and events are only applied once. Live delivery still needs a public HTTPS address. |

**Found and fixed in the review:**

| Warning | Fix |
| --- | --- |
| Capture ran without checking the order's status | The order must be approved before capture. |
| No retry for `429` and `5xx` errors | Retried with backoff using the same request ID, so a retry can't charge twice. |
| No cross-site protection on endpoints that spend money | Requests from other websites are refused in `src/proxy.ts`. |

**Left as they are, on purpose:**

| Finding | Why |
| --- | --- |
| Sandbox URL is hardcoded with no environment switch | This is the safety guarantee: the app cannot reach the live API. |
| Webhook handler returns `400` on a failed signature (info only) | An event that can't be verified shouldn't look accepted. |
| Token and signature-check requests have no request ID | Neither one moves money. |
| Local return URLs use HTTP | They only do so on `localhost`. Any hosted address must use HTTPS. |

## How AI and other tools are used

| Tool | How it is used |
| --- | --- |
| Google Gemini (free tier) | Understands requests, judges whether a listing is really what was asked for, reviews listings for deception, picks the best basket and explains decisions. If one model is busy another is tried, and if both are busy each agent falls back to rules. |
| Channel3 | Live product search with price, condition, gender and age filters. |
| Next.js, React, TypeScript, Tailwind CSS | The app and its server. |
| Vitest | Automated tests, including simulated PayPal failures. |

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

Then try a refund, the cart, the safety test in **Customize**, and **Verify hash chain**.

## Tests

```bash
npm test
```

## Known limits

- Payments are sandbox only and no goods are shipped. Scout finds real listings when Channel3 is on, but the sandbox payment does not buy from those retailers.
- Without autopay, the payer approves each order on PayPal's page.
- Cart tax is a flat 8% estimate, because no shipping address is collected. Single-product purchases carry no tax.
- State is kept in server memory and a local file. It suits a demo with one server process, not production.
- The console has no login, so it should only be hosted as a sandbox demo.

## License

MIT
