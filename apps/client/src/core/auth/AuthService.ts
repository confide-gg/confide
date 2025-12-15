import { httpClient } from "../network/HttpClient";
import type {
    AuthResponse,
    KeysResponse,
    LoginRequest,
    LoginResponse,
    PublicUser,
    RegisterRequest,
} from "./types";
import { SuccessResponse } from "../../shared/types/common";

class AuthService {
    public async register(data: RegisterRequest): Promise<AuthResponse> {
        const response = await httpClient.post<AuthResponse>("/auth/register", data);
        httpClient.setAuthToken(response.token);
        return response;
    }

    public async login(data: LoginRequest): Promise<LoginResponse> {
        const response = await httpClient.post<LoginResponse>("/auth/login", data);
        httpClient.setAuthToken(response.token);
        return response;
    }

    public async getMe(): Promise<PublicUser> {
        return httpClient.get<PublicUser>("/auth/me");
    }

    public async logout(): Promise<SuccessResponse> {
        const response = await httpClient.post<SuccessResponse>("/auth/logout");
        httpClient.setAuthToken(null);
        return response;
    }

    public async getKeys(): Promise<KeysResponse> {
        return httpClient.get<KeysResponse>("/auth/keys");
    }
}

export const authService = new AuthService();
