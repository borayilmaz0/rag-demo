import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { createSession, deleteSession, listKbs } from "../api";
import type { KnowledgeBase, ModeConfig, ModelConfig } from "../api";
import type { Session } from "../App";

interface Props {
  modes: ModeConfig[];
  models: ModelConfig[];
  onEnter: (s: Session) => void;
}

const STORAGE_KEY = "rag_sessions";
function loadSessions(): Session[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    // Migrate old single kb_id format
    return raw.map((s: any) => ({
      ...s,
      kb_ids:   s.kb_ids   ?? (s.kb_id ? [s.kb_id] : []),
      kb_names: s.kb_names ?? (s.kb_name && s.kb_id ? { [s.kb_id]: s.kb_name } : {}),
    }));
  } catch {
    return [];
  }
}
function saveSessions(s: Session[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export default function SessionPage({ modes, models, onEnter }: Props) {
  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [open, setOpen] = useState(false);
  const [modeId, setModeId] = useState(modes[0]?.id ?? "chat");
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => saveSessions(sessions), [sessions]);

  useEffect(() => {
    listKbs()
      .then((res) => setKbs(res.knowledge_bases))
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await createSession(modeId, modelId, selectedKbIds);
      const kb_names: Record<string, string> = {};
      for (const kb_id of res.kb_ids) {
        const found = kbs.find((k) => k.kb_id === kb_id);
        if (found) kb_names[kb_id] = found.name;
      }
      const session: Session = {
        session_id: res.session_id,
        mode_id:    res.mode_id,
        model_id:   res.model_id,
        label:      `Session ${new Date().toLocaleString()}`,
        created_at: new Date().toISOString(),
        kb_ids:     res.kb_ids,
        kb_names,
      };
      setSessions((prev) => [session, ...prev]);
      setOpen(false);
      onEnter(session);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, s: Session) => {
    e.stopPropagation();
    try { await deleteSession(s.session_id); } catch {}
    setSessions((prev) => prev.filter((x) => x.session_id !== s.session_id));
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Stack spacing={4}>
        <Box>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            RAG Assistant
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Chat with your documents using local or cloud models.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setSelectedKbIds([]); setOpen(true); }}
          sx={{ alignSelf: "flex-start" }}
        >
          New session
        </Button>

        <Stack spacing={1.5}>
          {sessions.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No sessions yet. Create one to get started.
            </Typography>
          )}
          {sessions.map((s) => (
            <Card key={s.session_id} variant="outlined">
              <CardActionArea onClick={() => onEnter(s)}>
                <CardContent>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body1" fontWeight={500}>
                        {s.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(s.created_at).toLocaleString()}
                      </Typography>
                      {s.kb_ids.length > 0 && (
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap">
                          <FolderOpenIcon sx={{ fontSize: 12, color: "text.secondary" }} />
                          {s.kb_ids.map((id) => (
                            <Typography key={id} variant="caption" color="text.secondary">
                              {s.kb_names[id] ?? id}
                            </Typography>
                          ))}
                        </Stack>
                      )}
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0, ml: 1 }}>
                      <Chip
                        label={modes.find((m) => m.id === s.mode_id)?.label ?? s.mode_id}
                        size="small" color="primary" variant="outlined"
                      />
                      <Chip
                        label={models.find((m) => m.id === s.model_id)?.label ?? s.model_id}
                        size="small" variant="outlined"
                      />
                      <Button size="small" color="error" onClick={(e) => handleDelete(e, s)} sx={{ minWidth: 0 }}>
                        Delete
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New session</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Mode</InputLabel>
              <Select value={modeId} label="Mode" onChange={(e) => setModeId(e.target.value)}>
                {modes.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    <Stack>
                      <Typography variant="body2">{m.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{m.description}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Model</InputLabel>
              <Select value={modelId} label="Model" onChange={(e) => setModelId(e.target.value)}>
                {models.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    <Stack>
                      <Typography variant="body2">{m.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{m.model}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Multi-select KB picker */}
            <FormControl fullWidth size="small">
              <InputLabel>Knowledge Bases (optional)</InputLabel>
              <Select
                multiple
                value={selectedKbIds}
                onChange={(e) => setSelectedKbIds(typeof e.target.value === "string" ? [e.target.value] : e.target.value)}
                input={<OutlinedInput label="Knowledge Bases (optional)" />}
                renderValue={(selected) =>
                  selected.map((id) => kbs.find((k) => k.kb_id === id)?.name ?? id).join(", ")
                }
              >
                {kbs.length === 0 && (
                  <MenuItem disabled>
                    <Typography variant="caption" color="text.secondary">No knowledge bases yet</Typography>
                  </MenuItem>
                )}
                {kbs.map((kb) => (
                  <MenuItem key={kb.kb_id} value={kb.kb_id}>
                    <Stack>
                      <Typography variant="body2">{kb.name}</Typography>
                      {kb.description && (
                        <Typography variant="caption" color="text.secondary">{kb.description}</Typography>
                      )}
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedKbIds.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {selectedKbIds.length} KB{selectedKbIds.length > 1 ? "s" : ""} will be searched alongside session documents.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={loading}>
            {loading ? "Creating…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
