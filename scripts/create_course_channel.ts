import { createChannel } from "../src/infrai_realtime.ts";

const courseId = process.argv[2];
const learnerId = process.argv[3];

if (!courseId || !learnerId) {
  throw new Error("Usage: npm run setup:channel -- <course-id> <learner-id>");
}

const channel = `course:${courseId}:learner:${learnerId}`;
await createChannel(channel, `channel:${courseId}:${learnerId}`);
console.log(JSON.stringify({ status: "created", channel }, null, 2));
