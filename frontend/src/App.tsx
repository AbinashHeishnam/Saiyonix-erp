import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./contexts/AuthContext";
import AppRoutes from "./routes/AppRoutes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: "14px",
              background: "#0f172a",
              color: "#fff",
              padding: "12px 18px",
              fontSize: "13px",
              fontWeight: "600",
              boxShadow: "0 12px 24px rgba(15, 23, 42, 0.18)",
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </QueryClientProvider>
  );
}
