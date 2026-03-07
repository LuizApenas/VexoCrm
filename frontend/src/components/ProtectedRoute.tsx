import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, mustChangePassword } = useAuth();
  const location = useLocation();
  const isSetPasswordPage = location.pathname === "/set-password";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (mustChangePassword && !isSetPasswordPage) {
    return <Navigate to="/set-password" replace />;
  }

  if (!mustChangePassword && isSetPasswordPage) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
