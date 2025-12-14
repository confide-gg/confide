import { get, post } from "./client";

export interface RecoveryStatusResponse {
  recovery_setup_completed: boolean;
}

export interface SetupRecoveryRequest {
  recovery_kem_encrypted_private: number[];
  recovery_dsa_encrypted_private: number[];
  recovery_key_salt: number[];
}

export interface RecoveryDataResponse {
  user_id: string;
  recovery_kem_encrypted_private: number[];
  recovery_dsa_encrypted_private: number[];
  recovery_key_salt: number[];
}

export interface ResetPasswordRequest {
  username: string;
  new_password: string;
  kem_public_key: number[];
  kem_encrypted_private: number[];
  dsa_public_key: number[];
  dsa_encrypted_private: number[];
  key_salt: number[];
  recovery_kem_encrypted_private: number[];
  recovery_dsa_encrypted_private: number[];
  recovery_key_salt: number[];
}

export interface ResetPasswordResponse {
  user: {
    id: string;
    username: string;
    kem_public_key: number[];
    dsa_public_key: number[];
  };
  token: string;
}

export async function setupRecovery(
  data: SetupRecoveryRequest
): Promise<RecoveryStatusResponse> {
  return post<RecoveryStatusResponse>("/recovery/setup", data);
}

export async function getRecoveryStatus(): Promise<RecoveryStatusResponse> {
  return get<RecoveryStatusResponse>("/recovery/status");
}

export async function getRecoveryData(
  username: string
): Promise<RecoveryDataResponse> {
  return post<RecoveryDataResponse>("/recovery/data", { username });
}

export async function resetPassword(
  data: ResetPasswordRequest
): Promise<ResetPasswordResponse> {
  return post<ResetPasswordResponse>("/recovery/reset", data);
}
