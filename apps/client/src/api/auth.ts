import { get, post, setAuthToken } from "./client";
import type {
  AuthResponse,
  KeysResponse,
  LoginRequest,
  LoginResponse,
  PublicUser,
  RegisterRequest,
  SuccessResponse,
} from "./types";

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const response = await post<AuthResponse>("/auth/register", data);
  setAuthToken(response.token);
  return response;
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await post<LoginResponse>("/auth/login", data);
  setAuthToken(response.token);
  return response;
}

export async function getMe(): Promise<PublicUser> {
  return get<PublicUser>("/auth/me");
}

export async function logout(): Promise<SuccessResponse> {
  const response = await post<SuccessResponse>("/auth/logout");
  setAuthToken(null);
  return response;
}

export async function getKeys(): Promise<KeysResponse> {
  return get<KeysResponse>("/auth/keys");
}
