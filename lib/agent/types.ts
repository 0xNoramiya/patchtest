import { z } from "zod";

export const proposedCartSchema = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().describe("A sku from the catalogue, exactly as written there."),
        reason: z
          .string()
          .describe("One short sentence on why this shopper. Cosmetic language only."),
      }),
    )
    .max(10),
  routine_note: z
    .string()
    .describe("Two sentences at most on how to use the routine. Cosmetic language only."),
});

export type ProposedCart = z.infer<typeof proposedCartSchema>;

export type AgentArm = "guarded" | "baseline";

export type AgentRound = {
  round: number;
  proposed: ProposedCart;
  blocked: string[];
  feedback?: string;
};

export type AgentResult = {
  arm: AgentArm;
  /** What the shopper ends up with, after the engine has had the last word. */
  finalCart: string[];
  rounds: AgentRound[];
  revisionRounds: number;
  routineNote: string;
  /** True when the runtime claim filter had to change the model's words. */
  claimsFiltered: boolean;
  source: "live" | "replay";
};
