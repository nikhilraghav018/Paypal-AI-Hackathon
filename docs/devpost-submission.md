# Devpost submission draft

## Name

Velora

## Tagline

Let AI agents shop without handing them your wallet.

## Inspiration

AI agents can now shop and pay, but people are stuck with two bad choices: approve every purchase themselves, which removes the point of an agent, or hand over a payment method with no limits. One bad decision or one manipulated listing can spend real money. We wanted to make it safe to let an agent actually transact.

## What it does

Velora is a shopping assistant run by seven AI agents, each with one job, working inside a budget and rules you set.

You type what you need in plain language. The agents find real products, screen them, choose the best one and check it against your limits. Small, clean purchases can pay by themselves through a saved PayPal account. Bigger ones wait for your approval, and unsafe ones are stopped.

- **Budget rules:** an auto-approve limit, a largest purchase and a monthly budget, plus always-blocked categories.
- **Agent autopay:** approve once on PayPal, and agents can pay on their own when every check passes.
- **Explore and cart:** compare every screened product, switch to another, or pay for products from several searches in one order.
- **Refunds:** refund a purchase and the budget is restored.
- **Tamper-evident audit trail:** every step is hash-chained, so an edit can be detected.
- **Safety test:** plant a fake scam listing, the cheapest in the results, and watch it get caught.

## How we built it

Velora is a Next.js and TypeScript app. The agents run in order on the server:

1. **Intake** turns the request into items, a budget and preferences.
2. **Scout** searches live products and drops anything that isn't really what you asked for.
3. **Risk Sentinel** quarantines prompt injection, off-platform payment requests, implausible prices and restricted goods.
4. **Deal Analyst** chooses the best basket within budget.
5. **Policy Guardian** decides to approve, ask you, or block. It is plain code with no AI, so no listing can talk its way past a limit.
6. **Auditor** explains the decision in plain language.
7. **Treasurer** is the only agent that can touch PayPal, and only with a short-lived signed mandate tied to the mission, amount and exact basket.

## PayPal technologies used

All in the free sandbox: Orders v2 (create, get, capture), Vault v3 (setup and payment tokens), Payments v2 (refund), and Webhooks with signature verification. Request IDs prevent double charges, and declined payment methods can be retried.

## Tools used

- **Google Gemini (free tier):** understands requests, judges whether a listing is really what was asked for, reviews listings for deception, picks the basket and explains decisions. AI can add a warning or a block but can never clear one.
- **Channel3:** live product search with filters for price, condition, gender and age.
- **Next.js, React, TypeScript, Tailwind CSS and Vitest:** the app, its server and its automated tests.

## Challenges we ran into

- Telling what a product is from words that merely appear in its title: the band Cigarettes After Sex is music, and wine glasses aren't alcohol.
- Finding wrong products, like tampons for a condom search, which needed a relevance check without using up the free AI quota.
- Keeping the app working when the free AI is rate limited or overloaded, which led to a second model and rule-based fallbacks.

## What we learned

The most useful thing an AI can do with money depends on what it is not allowed to do. Keeping the final decision in plain code let us use AI freely everywhere else.

## What's next

- Accounts for multiple users, with shared team budgets
- Different rules per category or merchant
- Agent-to-agent purchasing using the same mandates

## Still to add before submitting

- Demo video link
- How judges can try it (hosted link or run instructions)
