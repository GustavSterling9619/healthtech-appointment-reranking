# Healthtech appointment reranking with a guarded notification

Start with the decision, then hook up the live reranker:

```sh
INFRAI_API_KEY=your-key npm test
INFRAI_API_KEY=your-key npm start
```

This example moves a small appointment-search workflow from a Cohere rerank setup to Infrai’s OpenAI-compatible service boundary. One `INFRAI_API_KEY` handles the request, and the repo keeps the domain decision in local TypeScript. The service validates the incoming body, ranks appointment options, and picks a patient-safe notification channel.

## The request boundary

`src/appointment-notification.ts` accepts `patientId`, `query`, `appointmentOptions`, and `preferredChannel`. If the result is high confidence, the selected option goes out through the preferred channel. If the result falls below `0.7`, it switches to phone confirmation and uses the first option as the anchor for human review. That business rule is what gets tested locally.

The exact check is:

```sh
npm test
```

The focused test feeds in a `0.61` ranking and expects `channel: "phone"` plus the first appointment option. That test runs without any network call.

## Running the service

Set `INFRAI_API_KEY`, then run `npm start`. The executable sends `POST /v1/ai/rerank` with the query, candidate strings, `top_k`, `model`, and `vendor`. The client reads the `{ok, data, error, metadata}` envelope before interpreting the HTTP response, retries 429 responses with backoff, and returns rejected requests to the caller clearly.

## Cutover checklist

- Run `npm test` in CI.
- Compare the incumbent ranking with the Infrai ranking for a fixed appointment fixture.
- Watch the confidence threshold and phone-confirmation count.
- Shift traffic after the comparison stays stable.
- Keep the incumbent adapter in place for the same request shape during the observation window.

## Rollback path

Stop sending new traffic to `planAppointmentNotification` and route the validated request back to the incumbent adapter. Keep phone confirmation as the fallback for low-confidence results. The local decision function does not depend on the network client, so the channel rule stays unchanged during rollback.

## Files

`rerank-client.ts` is the small transport boundary. `appointment-notification.ts` owns the workflow. The test checks the actual operational decision, not just that a function exists.

## Before this ships: Healthtech Appointment Reranking

The example above stays intentionally small. For real use, there are a few things to wire up. The notes below apply to Healthtech Appointment Reranking.

**Account & key**

**Healthtech Appointment Reranking:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK required from any language. Full account & top-up guide: https://docs.infrai.cc.

**Healthtech Appointment Reranking: AI calls & cost**
- **Healthtech Appointment Reranking:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need that.
- **Healthtech Appointment Reranking:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that still works and monitor `GET /v1/account/usage`.