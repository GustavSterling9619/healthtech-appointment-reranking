import test from "node:test";
import assert from "node:assert/strict";
import { decideNotification, appointmentRequestSchema } from "./appointment-notification.ts";

test("low-confidence ranking routes the patient to a human confirmation channel", () => {
  const request = appointmentRequestSchema.parse({
    patientId: "p-1",
    query: "follow-up",
    appointmentOptions: ["Tuesday 09:00", "Wednesday 14:00"],
    preferredChannel: "sms"
  });
  assert.deepEqual(decideNotification(request, [{ index: 1, relevance_score: 0.61 }]), {
    patientId: "p-1",
    channel: "phone",
    option: "Tuesday 09:00",
    message: "Please call the care team to confirm an appointment."
  });
});
