import { saveTemplate } from "./db";
import type { RoleplayTemplate } from "./types";

export async function seedSalesDiscovery(ownerId: string) {
  const tpl: Omit<RoleplayTemplate, "id" | "createdAt" | "updatedAt"> = {
    ownerId,
    visibility: "public",
    title: "Sales Discovery Call (B2B)",
    description:
      "Practice a 10-minute discovery with a realistic buyer. Get judged on Data & Evidence, Logic, Organization, Refutation, and Style.",
    instructions:
      "You are running a discovery call with a B2B buyer. Ask questions, confirm pain, and tailor your value prop. A coach gives micro-tips; a judge scores at the end.",
    personas: [
      {
        id: crypto.randomUUID(),
        name: "Alex Chen",
        role: "Director of Operations",
        personality: "Pragmatic, time-boxed, skeptical but fair.",
        goals: "Reduce operational cost and improve reliability.",
        objections: ["We tried a similar tool", "Budget is tight", "Implementation risk"],
        tone: "Concise, professional",
        enabled: true,
      },
      {
        id: crypto.randomUUID(),
        name: "Jordan Patel",
        role: "Senior Engineer",
        personality: "Detail-oriented, risk-averse.",
        goals: "Minimize integration risk and security concerns.",
        objections: ["Security & uptime?", "Migration effort", "Vendor lock-in"],
        tone: "Neutral, technical",
        enabled: false,
      },
    ],
    variables: [
      { key: "company_name", label: "Company name", type: "text", required: true, placeholder: "Acme, Inc." },
      { key: "industry", label: "Industry", type: "select", options: ["SaaS", "Fintech", "Healthcare", "Retail", "Other"], required: true },
      { key: "product_pitch", label: "Your product in 1–2 sentences", type: "textarea", required: true },
      { key: "key_metric", label: "Key metric you improve", type: "text", required: true, placeholder: "onboarding time" },
      { key: "competitor_used", label: "Competitor they use (optional)", type: "text" },
    ],
    timeLimits: { rounds: 2, perTurnSec: 60 },
    rubric: {
      dimensions: ["data", "logic", "organization", "refutation", "style"],
      scale: 10,
      instructions: "Score objectively on the five debate criteria. Give short bullets and end with [[FEEDBACK_COMPLETE]].",
    },
    tags: ["Sales", "Discovery", "B2B"],
  };
  return await saveTemplate(tpl);
}