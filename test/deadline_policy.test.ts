import assert from "node:assert/strict";
import test from "node:test";
import { decideDeadlineReminder } from "../src/deadline_policy.ts";

const reminder = {
  courseId: "typescript-201",
  learnerId: "learner-42",
  assignmentId: "assignment-7",
  assignmentTitle: "Server Actions lab",
  dueAt: "2026-09-01T12:00:00.000Z",
};

test("publishes a reminder inside the final 24 hours", () => {
  assert.deepEqual(
    decideDeadlineReminder(reminder, new Date("2026-08-31T18:00:00.000Z")),
    { action: "publish", hoursRemaining: 18 },
  );
});

test("skips a reminder before the final 24 hours", () => {
  assert.deepEqual(
    decideDeadlineReminder(reminder, new Date("2026-08-30T11:00:00.000Z")),
    { action: "skip", reason: "outside_reminder_window" },
  );
});
