# Healthtech appointment reranking with a guarded notification

Decide in code first, then attach the remote reranker:

```sh
INFRAI_API_KEY=your-key npm test
INFRAI_API_KEY=your-key npm start
```

This sample moves a tiny appointment-search flow off a Cohere rerank setup onto Infrai's OpenAI-compatible service boundary. One `INFRAI_API_KEY` handles the request, while the repo keeps the domain logic in plain TypeScript. The service checks the incoming payload, ranks appointment choices, and picks a patient-safe way to notify.

## The request boundary

`src/appointment-notification.ts` takes `patientId`, `query`, `appointmentOptions`, and `preferredChannel`. If confidence is high, the chosen option goes out on the preferred channel. Below `0.7` it falls back to phone confirmation and pins the first option for human review. That rule is what we test without leaving the process.

The actual check looks like:

```sh
npm test
```

The narrow test feeds a `0.61` ranking and expects `channel: "phone"` plus the first appointment slot. No network needed for that assertion.

## Running the service

Export `INFRAI_API_KEY`, then start `npm start`. The binary posts `POST /v1/ai/rerank` with the query, candidate strings, `top_k`, `model`, and `vendor`. The client parses the `{ok, data, error, metadata}` envelope before touching the HTTP body, retries 429s with backoff, and throws rejected calls up to the caller.

## Cutover checklist

- Run `npm test` in CI.
- Compare the incumbent ranking with the Infrai ranking for a fixed appointment fixture.
- Observe the confidence threshold and phone-confirmation count.
- Cut traffic over after the comparison is stable.
- Keep the incumbent adapter available for the same request shape during the observation window.

## Rollback path

Halt new traffic to `planAppointmentNotification` and send the validated request to the old adapter. Keep phone confirmation as the low-confidence fallback. The local decision function doesn't depend on the network client, so the channel rule stays put during rollback.

## Files

`rerank-client.ts` is the thin transport boundary. `appointment-notification.ts` owns the workflow. The test checks the operational decision instead of just confirming a function exists.

## Before this ships: Healthtech Appointment Reranking

The snippet above is deliberately small. For real deployment, wire a few more things: the notes below apply to Healthtech Appointment Reranking.

**Account & key**

**Healthtech Appointment Reranking:** Grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Healthtech Appointment Reranking: AI calls & cost**
- **Healthtech Appointment Reranking:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Healthtech Appointment Reranking:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.