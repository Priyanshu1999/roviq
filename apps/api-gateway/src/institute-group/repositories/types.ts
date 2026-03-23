export interface InstituteGroupRecord {
  id: string;
  name: string;
  code: string;
  type: string;
  registrationNo: string | null;
  registrationState: string | null;
  contact: Record<string, unknown>;
  address: Record<string, unknown> | null;
  status: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInstituteGroupData {
  name: string;
  code: string;
  type: string;
  registrationNo?: string;
  registrationState?: string;
  contact?: Record<string, unknown>;
  address?: Record<string, unknown>;
}

export interface UpdateInstituteGroupData {
  name?: string;
  registrationNo?: string;
  registrationState?: string;
  contact?: Record<string, unknown>;
  address?: Record<string, unknown>;
}

export interface InstituteGroupSearchParams {
  search?: string;
  status?: string;
  type?: string;
  first?: number;
  after?: string;
}

export interface GroupMembershipRecord {
  id: string;
  userId: string;
  groupId: string;
  roleId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
