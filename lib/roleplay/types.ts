export type Visibility = "private" | "org" | "public";

export type RoleplayVariable = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[];
  required?: boolean;
  placeholder?: string;
};

export type RoleplayPersona = {
  id: string;
  name: string;
  role: string;
  personality: string;
  goals: string;
  objections: string[];
  tone?: string;
  enabled?: boolean;
};

export type RubricKey =
  | "data"
  | "logic"
  | "organization"
  | "refutation"
  | "style";

export type RoleplayRubric = {
  dimensions: RubricKey[];
  scale: 10; // fixed 0–10 scale
  instructions?: string;
};

export type RoleplayTemplate = {
  id: string;
  ownerId: string;
  visibility: Visibility;
  title: string;
  description: string;
  instructions: string;
  personas: RoleplayPersona[];
  variables: RoleplayVariable[];
  timeLimits: { rounds: number; perTurnSec: number };
  rubric: RoleplayRubric;
  tags: string[];
  createdAt: any;
  updatedAt: any;
};

export type RoleplayInstance = {
  id: string;
  templateId: string;
  templateSnapshot: Omit<RoleplayTemplate, "id" | "createdAt" | "updatedAt">;
  createdBy: string;
  variables: Record<string, string>;
  createdAt: any;
};

// ✅ payload type used when creating a new doc (no id yet)
export type NewRoleplayInstance = Omit<RoleplayInstance, "id">;
