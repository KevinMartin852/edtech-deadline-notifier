import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import { decideDeadlineReminder, type DeadlineReminder } from "./deadline_policy.ts";
import { InfraiError, issueRealtimeToken, publishDeadlineEvent } from "./infrai_realtime.ts";

const reminderSchema = z.object({
  courseId: z.string().min(1),
  learnerId: z.string().min(1),
  assignmentId: z.string().min(1),
  assignmentTitle: z.string().min(1),
  dueAt: z.string().datetime(),
});

const tokenSchema = z.object({
  learnerId: z.string().min(1),
  courseId: z.string().min(1),
});

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function clientStatus(error: InfraiError): number {
  return error.status >= 400 && error.status < 500 ? error.status : 502;
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/api/deadline-reminders") {
      const reminder = reminderSchema.parse(await readJson(request)) as DeadlineReminder;
      const decision = decideDeadlineReminder(reminder, new Date());
      if (decision.action === "skip") {
        sendJson(response, 200, { status: "skipped", reason: decision.reason });
        return;
      }

      const channel = `course:${reminder.courseId}:learner:${reminder.learnerId}`;
      const idempotencyKey = `deadline:${reminder.assignmentId}:${reminder.dueAt}`;
      await publishDeadlineEvent(
        channel,
        {
          assignmentId: reminder.assignmentId,
          assignmentTitle: reminder.assignmentTitle,
          dueAt: reminder.dueAt,
          hoursRemaining: decision.hoursRemaining,
        },
        reminder.learnerId,
        idempotencyKey,
      );
      sendJson(response, 202, { status: "published", channel });
      return;
    }

    if (request.method === "POST" && request.url === "/api/realtime-token") {
      const input = tokenSchema.parse(await readJson(request));
      const channel = `course:${input.courseId}:learner:${input.learnerId}`;
      const token = await issueRealtimeToken(input.learnerId, [channel]);
      sendJson(response, 200, token);
      return;
    }

    sendJson(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendJson(response, 400, { error: "Invalid request body", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      sendJson(response, clientStatus(error), {
        error: error.message,
        code: error.code,
      });
      return;
    }
    sendJson(response, 500, { error: "Unexpected service error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Deadline notification service listening on http://localhost:${port}`);
});
