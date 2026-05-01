import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";
import Record from "./pages/Record";
import Upload from "./pages/Upload";
import History from "./pages/History";
import HistoryDetail from "./pages/HistoryDetail";
import AddVoice from "./pages/AddVoice";
import Settings from "./pages/Settings";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import SquiggleFilter from "@/components/sketch/SquiggleFilter";
import SmoothScroll from "@/components/sketch/SmoothScroll";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <TooltipProvider>
      <SquiggleFilter />
      <Toaster />
      <Sonner />
      <SmoothScroll>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/setup"
              element={
                <RequireAuth>
                  <Setup />
                </RequireAuth>
              }
            />
            <Route path="/dashboard" element={<Dashboard />}>
              <Route index element={<Record />} />
              <Route path="upload" element={<Upload />} />
              <Route path="history" element={<History />} />
              <Route path="history/:id" element={<HistoryDetail />} />
              <Route path="add-voice" element={<AddVoice />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </SmoothScroll>
    </TooltipProvider>
  );
}
