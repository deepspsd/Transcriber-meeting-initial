import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";
import Record from "./pages/Record";
import Upload from "./pages/Upload";
import TabAudio from "./pages/TabAudio";
import History from "./pages/History";
import HistoryDetail from "./pages/HistoryDetail";
import AddVoice from "./pages/AddVoice";
import Settings from "./pages/Settings";
import Landing from "./pages/Landing";
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
      <BrowserRouter>
        <Routes>
          {/* Public landing — manages its own Lenis instance */}
          <Route path="/" element={<Landing />} />

          {/* Auth */}
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

          {/* Dashboard (smooth-scroll handled here) */}
          <Route
            path="/dashboard"
            element={
              <SmoothScroll>
                <Dashboard />
              </SmoothScroll>
            }
          >
            <Route index element={<Record />} />
            <Route path="tab-audio" element={<TabAudio />} />
            <Route path="upload" element={<Upload />} />
            <Route path="history" element={<History />} />
            <Route path="history/:id" element={<HistoryDetail />} />
            <Route path="add-voice" element={<AddVoice />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Catch-all → landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
}
