export type ReviewWorkspaceStatus = "draft" | "finalized";

export type ReviewWorkspace = {
  id: string;
  name: string;
  projectId: string;
  methodCode: string;
  methodVersion: string;
  reportingPeriod?: string;
  status: ReviewWorkspaceStatus;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  finalizedAt?: string;
};
