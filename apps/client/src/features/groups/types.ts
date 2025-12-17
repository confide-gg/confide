import type { PublicUser } from "../../core/auth/types";

export interface GroupMetadata {
  name: string;
  icon?: string;
}

export interface GroupMember {
  user: PublicUser;
  encrypted_role: number[];
  joined_at: string;
  is_owner: boolean;
}

