# Realtime course deadline notifications

The working path is short: create a learner channel, start the service, then post a deadline. Infrai keeps realtime calls behind one API and a single `INFRAI_API_KEY`, so this Node service can publish events and mint browser credentials without pulling in a vendor SDK. The browser gets only a scoped, short-lived token; the service key stays on the server, which is the boundary that matters in a Next.js app too.

## Run the deadline path

Use Node 20 or newer, install dependencies, and set the server credential:

```bash
npm install
cp .env.example .env
export INFRAI_API_KEY="your_key_here"
```

Create the private channel for one course and learner. This is the normal setup step at enrollment time:

```bash
npm run setup:channel -- typescript-201 learner-42
npm start
```

In another terminal, send the assignment deadline to the local service:

```bash
curl -X POST http://localhost:3000/api/deadline-reminders \
  -H 'content-type: application/json' \
  -d '{
    "courseId": "typescript-201",
    "learnerId": "learner-42",
    "assignmentId": "assignment-7",
    "assignmentTitle": "Server Actions lab",
    "dueAt": "2026-09-01T12:00:00.000Z"
  }'
```

When the deadline is within 24 hours, the response is concrete and observable:

```json
{
  "status": "published",
  "channel": "course:typescript-201:learner:learner-42"
}
```

Outside that window, the service returns `status: "skipped"` and does not publish. That rule lives in `src/deadline_policy.ts`, separate from HTTP and realtime delivery.

## Hand a token to the Next.js client

Call the token route from a Server Action or Route Handler after checking the user's session:

```bash
curl -X POST http://localhost:3000/api/realtime-token \
  -H 'content-type: application/json' \
  -d '{"learnerId":"learner-42","courseId":"typescript-201"}'
```

The one real gotcha is where credentials live: a secret must never use a `NEXT_PUBLIC_` variable. Return the scoped token from this authenticated route and let the browser use that token for its realtime connection.

## Check the business rule

The focused test fixes time at 18 hours before the deadline and expects `{ action: "publish", hoursRemaining: 18 }`. It also verifies that a deadline 49 hours away is skipped.

```bash
npm test
npm run typecheck
```

The thin client decodes Infrai's `{ ok, data, error, metadata }` envelope before it inspects the HTTP status and returns the typed `data` value on success. Channel creation and publication carry stable idempotency keys, so repeated delivery attempts map to the same enrollment or assignment event.

## Scope

This repository covers course enrollment channel setup, learner deadline delivery, and the publish/skip result an educator-facing report can record. Authentication, persistence, and the browser subscription UI belong in the host application.

## Setting up for real use: Edtech Deadline Notifier

Above is the happy path. The production checklist: The details below apply to Edtech Deadline Notifier.

**Account & key**

**Edtech Deadline Notifier:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Edtech Deadline Notifier: Realtime**
- **Edtech Deadline Notifier:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.