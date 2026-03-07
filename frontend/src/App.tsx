import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/AppSidebar";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Agente from "./pages/Agente";
import Leads from "./pages/Leads";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import SetPassword from "./pages/SetPassword";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/set-password"
              element={
                <ProtectedRoute>
                  <SetPassword />
                </ProtectedRoute>
              }
            />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen w-full">
                    <AppSidebar />
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/leads" element={<Leads />} />
                      <Route path="/agente" element={<Agente />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
