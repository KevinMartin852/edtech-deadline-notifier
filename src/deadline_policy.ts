export type DeadlineReminder = {
  courseId: string;
  learnerId: string;
  assignmentId: string;
  assignmentTitle: string;
  dueAt: string;
};

export type ReminderDecision =
  | { action: "publish"; hoursRemaining: number }
  | { action: "skip"; reason: "outside_reminder_window" | "deadline_passed" };

export function decideDeadlineReminder(
  reminder: DeadlineReminder,
  now: Date,
): ReminderDecision {
  const hoursRemaining = (Date.parse(reminder.dueAt) - now.getTime()) / 3_600_000;

  if (hoursRemaining <= 0) {
    return { action: "skip", reason: "deadline_passed" };
  }
  if (hoursRemaining > 24) {
    return { action: "skip", reason: "outside_reminder_window" };
  }

  return { action: "publish", hoursRemaining };
}
