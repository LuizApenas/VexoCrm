import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { MainLayout } from "@/components/MainLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Agente from "./pages/Agente";
import ClientPortalDashboard from "./pages/ClientPortalDashboard";
import ClientPortalLeads from "./pages/ClientPortalLeads";
import LandingPage from "./pages/LandingPage";
import Leads from "./pages/Leads";
import LeadImports from "./pages/LeadImports";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import SetPassword from "./pages/SetPassword";
import PendingApproval from "./pages/PendingApproval";
import ClientSignup from "./pages/ClientSignup";
import UserAccessManagement from "./pages/UserAccessManagement";
import WhatsAppInbox from "./pages/WhatsAppInbox";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/home" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro-cliente" element={<ClientSignup />} />
            <Route path="/crm/login" element={<Navigate to="/login" replace />} />
            <Route
              path="/set-password"
              element={
                <ProtectedRoute>
                  <SetPassword />
                </ProtectedRoute>
              }
            />
            <Route
              path="/aguardando-aprovacao"
              element={
                <ProtectedRoute allowedRoles={["pending"]}>
                  <PendingApproval />
                </ProtectedRoute>
              }
            />
            <Route path="/dashboard" element={<Navigate to="/crm/dashboard" replace />} />
            <Route path="/leads" element={<Navigate to="/crm/leads" replace />} />
            <Route path="/planilhas" element={<Navigate to="/crm/planilhas" replace />} />
            <Route path="/agente" element={<Navigate to="/crm/agente" replace />} />
            <Route path="/whatsapp" element={<Navigate to="/crm/whatsapp" replace />} />
            <Route
              path="/crm"
              element={
                <ProtectedRoute allowedRoles={["internal"]}>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="leads" element={<Leads />} />
              <Route path="planilhas" element={<LeadImports />} />
              <Route path="whatsapp" element={<WhatsAppInbox />} />
              <Route path="agente" element={<Agente />} />
              <Route path="usuarios" element={<UserAccessManagement />} />
            </Route>
            <Route
              path="/clientes/:clientId"
              element={
                <ProtectedRoute allowedRoles={["internal", "client"]}>
                  <ClientPortalLayout />
                </ProtectedRoute>
              }
            >
              <Route
                index
                element={
                  <ProtectedRoute allowedRoles={["internal", "client"]}>
                    <Navigate to="dashboard" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="dashboard"
                element={
                  <ProtectedRoute allowedRoles={["internal", "client"]} requiredView="dashboard">
                    <ClientPortalDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="leads"
                element={
                  <ProtectedRoute allowedRoles={["internal", "client"]} requiredView="leads">
                    <ClientPortalLeads />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
