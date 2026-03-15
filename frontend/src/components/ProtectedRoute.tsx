import { type AccessRole, useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AccessRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, loading, mustChangePassword, accessRole, defaultRoute } = useAuth();
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
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (mustChangePassword && !isSetPasswordPage) {
    return <Navigate to="/set-password" replace state={{ from: location }} />;
  }

  if (!mustChangePassword && isSetPasswordPage) {
    return <Navigate to={defaultRoute} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(accessRole)) {
    return <Navigate to={defaultRoute} replace />;
  }

  return <>{children}</>;
}
