import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-background">
      <div className="flex flex-col items-center gap-6 p-8 rounded-xl border bg-card shadow-lg max-w-sm w-full">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-xl">⚡</span>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Infinie</h1>
          <p className="text-sm text-muted-foreground mt-1">Soluções Renováveis</p>
        </div>
        <Button onClick={signInWithGoogle} className="w-full" size="lg">
          Entrar com Google
        </Button>
      </div>
    </div>
  );
}
