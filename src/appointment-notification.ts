import { z } from "zod";
import { rerank, type RankedCandidate } from "./rerank-client.ts";

export const appointmentRequestSchema = z.object({
  patientId: z.string().min(1),
  query: z.string().min(1),
  appointmentOptions: z.array(z.string().min(1)).min(1),
  preferredChannel: z.enum(["sms", "phone"])
});

export type AppointmentRequest = z.infer<typeof appointmentRequestSchema>;
export type AppointmentDecision = { patientId: string; channel: "sms" | "phone"; message: string; option: string };

export function decideNotification(input: AppointmentRequest, ranking: RankedCandidate[]): AppointmentDecision {
  const best = ranking[0];
  if (!best || best.relevance_score < 0.7) {
    return { patientId: input.patientId, channel: "phone", option: input.appointmentOptions[0], message: "Please call the care team to confirm an appointment." };
  }
  return {
    patientId: input.patientId,
    channel: input.preferredChannel,
    option: input.appointmentOptions[best.index],
    message: `Appointment option selected: ${input.appointmentOptions[best.index]}.`
  };
}

export async function planAppointmentNotification(raw: unknown): Promise<AppointmentDecision> {
  const input = appointmentRequestSchema.parse(raw);
  const ranking = await rerank({ query: input.query, candidates: input.appointmentOptions, top_k: 1, model: "healthtech-rerank", vendor: "qwen" });
  return decideNotification(input, ranking);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await planAppointmentNotification({
    patientId: "patient-1042",
    query: "follow-up after cardiology visit",
    appointmentOptions: ["Tuesday 09:00 with cardiology", "Wednesday 14:00 with dermatology"],
    preferredChannel: "sms"
  });
  console.log(JSON.stringify(result, null, 2));
}
