import { Outlet } from "react-router-dom";
import { LoginScene } from "../three";

export function AuthLayout() {
  return (
    <div className="min-h-screen relative">
      <LoginScene />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <Outlet />
      </div>
    </div>
  );
}
