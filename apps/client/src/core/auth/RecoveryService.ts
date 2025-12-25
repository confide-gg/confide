import { httpClient } from "../network/HttpClient";

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

class RecoveryService {
  public async setupRecovery(data: SetupRecoveryRequest): Promise<RecoveryStatusResponse> {
    return httpClient.post<RecoveryStatusResponse>("/recovery/setup", data);
  }

  public async getRecoveryStatus(): Promise<RecoveryStatusResponse> {
    return httpClient.get<RecoveryStatusResponse>("/recovery/status");
  }

  public async getRecoveryData(username: string): Promise<RecoveryDataResponse> {
    return httpClient.post<RecoveryDataResponse>("/recovery/data", { username });
  }

  public async resetPassword(data: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    return httpClient.post<ResetPasswordResponse>("/recovery/reset", data);
  }
}

export const recoveryService = new RecoveryService();
