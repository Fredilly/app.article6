export type IntakeStatus = "new" | "triaged" | "in-progress" | "done";

export type IntakeItem = {
  id: string;
  created_at: string;
  method: string;
  version: string;
  rule_id?: string | null;
  sectionId?: string | null;
  type: string;
  description: string;
  status: IntakeStatus;
  owner?: string | null;
};

export type IntakeItemInput = {
  method: string;
  version: string;
  rule_id?: string | null;
  sectionId?: string | null;
  type: string;
  description: string;
  status?: IntakeStatus;
  owner?: string | null;
  created_at?: string;
};

export type PilotCadence = {
  last_review_at?: string | null;
  next_review_at?: string | null;
};
