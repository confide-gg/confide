export interface PublicUser {
  id: string;
  username: string;
  kem_public_key: number[];
  dsa_public_key: number[];
}

export interface AuthResponse {
  user: PublicUser;
  token: string;
}

export interface LoginResponse {
  user: PublicUser;
  token: string;
  kem_encrypted_private: number[];
  dsa_encrypted_private: number[];
  key_salt: number[];
}

export interface KeysResponse {
  kem_encrypted_private: number[];
  dsa_encrypted_private: number[];
  key_salt: number[];
}

export interface RegisterRequest {
  username: string;
  password: string;
  kem_public_key: number[];
  kem_encrypted_private: number[];
  dsa_public_key: number[];
  dsa_encrypted_private: number[];
  key_salt: number[];
}

export interface LoginRequest {
  username: string;
  password: string;
}
