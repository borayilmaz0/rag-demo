import { useState, useEffect } from "react";
import {
  Box,
  CircularProgress,
  CssBaseline,
  ThemeProvider,
  Typography,
  createTheme,
} from "@mui/material";
import SessionPage from "./pages/SessionPage";
import ChatPage from "./pages/ChatPage";
import { getConfig } from "./api";
import type { AppConfig } from "./api";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#7C6AF7" },
    background: { default: "#0F0F11", paper: "#1A1A1F" },
  },
  typography: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { defaultProps: { elevation: 0 } },
  },
});

// Session is frontend-only. session_id, mode_id, model_id come from backend;
// label and created_at are assembled client-side.
export interface Session {
  session_id: string;
  mode_id: string;
  model_id: string; // config model id (e.g. "local-qwen")
  label: string;
  created_at: string;
  kb_ids: string[];           // attached KB IDs
  kb_names: Record<string, string>; // kb_id → name, for display
}

export default function App() {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    getConfig()
      .then(setConfig)
      .catch((e) =>
        setConfigError(e.message ?? "Failed to load config from backend."),
      );
  }, []);

  if (!config && !configError) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: 2,
          }}
        >
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            Loading configuration…
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  if (configError || !config) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            p: 4,
          }}
        >
          <Box sx={{ maxWidth: 480, textAlign: "center" }}>
            <Typography variant="h6" gutterBottom color="error">
              Configuration error
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {configError}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Make sure config.json is mounted at /app/config.json and the
              backend is running.
            </Typography>
          </Box>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {activeSession ? (
        <ChatPage
          session={activeSession}
          modes={config.modes}
          models={config.models}
          onLeave={() => setActiveSession(null)}
        />
      ) : (
        <SessionPage
          modes={config.modes}
          models={config.models}
          onEnter={setActiveSession}
        />
      )}
    </ThemeProvider>
  );
}
