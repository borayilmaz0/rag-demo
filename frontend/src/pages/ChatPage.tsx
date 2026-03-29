import { useState, useEffect, useRef, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import LockIcon from "@mui/icons-material/Lock";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import SendIcon from "@mui/icons-material/Send";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  ask,
  attachKb,
  deleteDocument,
  deleteKbDocument,
  deleteSession,
  detachKb,
  exportSessionToKb,
  getKbDocuments,
  listDocuments,
  listKbs,
  switchMode,
  switchModel,
  toggleDoc,
  toggleKb,
  uploadFile,
  uploadFileToKb,
  TOP_K_PRESETS,
} from "../api";
import MarkdownContent from "../components/MarkdownContent";
import type {
  Doc,
  KnowledgeBase,
  Source,
  ModeConfig,
  ModelConfig,
} from "../api";
import type { Session } from "../App";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  searchEnabled?: boolean;
  modelId?: string;
}

// KB state tracked client-side (source of truth is session state on backend)
interface KbEntry {
  kb_id: string;
  name: string;
  enabled: boolean;
  docs: Doc[];
  expanded: boolean;
}

const DRAWER_WIDTH = 300;

interface Props {
  session: Session;
  modes: ModeConfig[];
  models: ModelConfig[];
  onLeave: () => void;
}

export default function ChatPage({
  session: initialSession,
  modes,
  models,
  onLeave,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [modeId, setModeId] = useState(initialSession.mode_id);
  const [modelId, setModelId] = useState(initialSession.model_id);
  const [sessionDocs, setSessionDocs] = useState<Doc[]>([]);
  const [disabledDocIds, setDisabledDocIds] = useState<Set<string>>(new Set());
  const [kbEntries, setKbEntries] = useState<KbEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<number>>(
    new Set(),
  );
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [topK, setTopK] = useState<number>(5);
  const [customTopK, setCustomTopK] = useState<string>("");

  // Add KB dialog
  const [addKbDialog, setAddKbDialog] = useState(false);
  const [availableKbs, setAvailableKbs] = useState<KnowledgeBase[]>([]);
  const [addKbId, setAddKbId] = useState("");
  const [addKbLoading, setAddKbLoading] = useState(false);

  // Upload to KB dialog
  const [kbUploadDialog, setKbUploadDialog] = useState<{
    kb_id: string;
    kb_name: string;
  } | null>(null);
  const [kbUploadToken, setKbUploadToken] = useState("");
  const [kbUploadFile, setKbUploadFile] = useState<File | null>(null);
  const [kbUploadDrag, setKbUploadDrag] = useState(false);
  const [kbUploading, setKbUploading] = useState(false);
  const [kbUploadStatus, setKbUploadStatus] = useState("");
  const [kbUploadError, setKbUploadError] = useState<string | null>(null);
  const kbFileInputRef = useRef<HTMLInputElement>(null);

  // KB delete dialog
  const [kbDeleteDialog, setKbDeleteDialog] = useState<{
    doc: Doc;
    kb_id: string;
  } | null>(null);
  const [kbDeleteToken, setKbDeleteToken] = useState("");
  const [kbDeleteError, setKbDeleteError] = useState<string | null>(null);
  const [kbDeleting, setKbDeleting] = useState(false);

  // Export to KB dialog
  const [exportDialog, setExportDialog] = useState(false);
  const [exportName, setExportName] = useState("");
  const [exportDescription, setExportDescription] = useState("");
  const [exportResult, setExportResult] = useState<{
    kb_id: string;
    name: string;
    write_token: string;
    chunks_copied: number;
  } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionId = initialSession.session_id;

  const currentMode = modes.find((m) => m.id === modeId) ?? modes[0];
  const effectiveTopK = (() => {
    const parsed = parseInt(customTopK, 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : topK;
  })();
  const willSearch = currentMode?.force_search || searchEnabled;

  useEffect(() => {
    if (currentMode?.force_search) setSearchEnabled(false);
  }, [modeId, currentMode]);

  const refreshSessionDocs = useCallback(async () => {
    try {
      const res = await listDocuments(sessionId);
      setSessionDocs(res.documents);
    } catch {}
  }, [sessionId]);

  const refreshKbDocs = useCallback(async (kb_id: string) => {
    try {
      const res = await getKbDocuments(kb_id);
      setKbEntries((prev) =>
        prev.map((e) =>
          e.kb_id === kb_id ? { ...e, docs: res.documents } : e,
        ),
      );
    } catch {}
  }, []);

  // Init KB entries from session
  useEffect(() => {
    const entries: KbEntry[] = initialSession.kb_ids.map((kb_id) => ({
      kb_id,
      name: initialSession.kb_names[kb_id] ?? kb_id,
      enabled: true,
      docs: [],
      expanded: false,
    }));
    setKbEntries(entries);
    entries.forEach((e) => refreshKbDocs(e.kb_id));
    refreshSessionDocs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleModeChange = async (newModeId: string) => {
    setModeId(newModeId);
    try {
      await switchMode(sessionId, newModeId);
    } catch {}
  };

  const handleModelChange = async (newModelId: string) => {
    setModelId(newModelId);
    try {
      await switchModel(sessionId, newModelId);
    } catch {}
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await ask(sessionId, text, willSearch, effectiveTopK);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.answer,
          sources: res.sources,
          searchEnabled: res.search_enabled,
          modelId: res.model_id,
        },
      ]);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadStatus(`${i + 1}/${files.length} — ${files[i].name}`);
        await uploadFile(files[i], sessionId, setUploadStatus);
      }
      await refreshSessionDocs();
    } catch (e: any) {
      const msg = e.message ?? "Upload failed.";
      setError(msg.includes("409") ? `Duplicate: ${msg.split("Duplicate:").pop()?.trim() ?? msg}` : msg);
    } finally {
      setUploading(false);
      setUploadStatus("");
    }
  };

  // ── KB management ────────────────────────────────────────────────────────────

  const handleToggleKb = async (kb_id: string, enabled: boolean) => {
    setKbEntries((prev) =>
      prev.map((e) => (e.kb_id === kb_id ? { ...e, enabled } : e)),
    );
    try {
      await toggleKb(sessionId, kb_id, enabled);
    } catch {}
  };

  const handleDetachKb = async (kb_id: string) => {
    try {
      await detachKb(sessionId, kb_id);
      setKbEntries((prev) => prev.filter((e) => e.kb_id !== kb_id));
    } catch (e: any) {
      setError(e.message ?? "Detach failed.");
    }
  };

  const handleToggleKbExpand = (kb_id: string) => {
    setKbEntries((prev) =>
      prev.map((e) =>
        e.kb_id === kb_id ? { ...e, expanded: !e.expanded } : e,
      ),
    );
  };

  const handleOpenAddKb = async () => {
    try {
      const res = await listKbs();
      const attached = new Set(kbEntries.map((e) => e.kb_id));
      setAvailableKbs(
        res.knowledge_bases.filter((kb) => !attached.has(kb.kb_id)),
      );
    } catch {}
    setAddKbId("");
    setAddKbDialog(true);
  };

  const handleAddKb = async () => {
    if (!addKbId) return;
    setAddKbLoading(true);
    try {
      await attachKb(sessionId, addKbId);
      const kb = availableKbs.find((k) => k.kb_id === addKbId)!;
      setKbEntries((prev) => [
        ...prev,
        {
          kb_id: addKbId,
          name: kb.name,
          enabled: true,
          docs: [],
          expanded: false,
        },
      ]);
      await refreshKbDocs(addKbId);
      setAddKbDialog(false);
    } catch (e: any) {
      setError(e.message ?? "Failed to attach KB.");
    } finally {
      setAddKbLoading(false);
    }
  };

  // ── Document toggles ─────────────────────────────────────────────────────────

  const handleToggleDoc = async (doc_id: string, enabled: boolean) => {
    setDisabledDocIds((prev) => {
      const next = new Set(prev);
      enabled ? next.delete(doc_id) : next.add(doc_id);
      return next;
    });
    try {
      await toggleDoc(sessionId, doc_id, enabled);
    } catch {}
  };

  // ── Session doc delete ───────────────────────────────────────────────────────

  const handleDeleteSessionDoc = async (doc: Doc) => {
    try {
      await deleteDocument(doc.doc_id, sessionId);
      await refreshSessionDocs();
    } catch (e: any) {
      setError(e.message ?? "Delete failed.");
    }
  };

  // ── KB doc delete ────────────────────────────────────────────────────────────

  const handleKbDeleteConfirm = async () => {
    if (!kbDeleteDialog) return;
    setKbDeleting(true);
    setKbDeleteError(null);
    try {
      await deleteKbDocument(
        kbDeleteDialog.kb_id,
        kbDeleteDialog.doc.doc_id,
        kbDeleteToken,
      );
      await refreshKbDocs(kbDeleteDialog.kb_id);
      setKbDeleteDialog(null);
      setKbDeleteToken("");
    } catch (e: any) {
      setKbDeleteError(e.message ?? "Delete failed. Check your write token.");
    } finally {
      setKbDeleting(false);
    }
  };

  // ── Export to KB ─────────────────────────────────────────────────────────────

  const handleExportToKb = async () => {
    if (!exportName.trim()) return;
    setExporting(true);
    setExportError(null);
    try {
      const result = await exportSessionToKb(
        sessionId,
        exportName.trim(),
        exportDescription.trim() || null,
      );
      setExportResult(result);
    } catch (e: any) {
      setExportError(e.message ?? "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const handleCopyToken = () => {
    if (!exportResult) return;
    navigator.clipboard.writeText(exportResult.write_token);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  const handleExportClose = () => {
    setExportDialog(false);
    setExportName("");
    setExportDescription("");
    setExportResult(null);
    setExportError(null);
    setTokenCopied(false);
  };

  const handleKbUpload = async () => {
    if (!kbUploadDialog || !kbUploadFile || !kbUploadToken) return;
    setKbUploading(true);
    setKbUploadError(null);
    try {
      await uploadFileToKb(
        kbUploadFile,
        kbUploadDialog.kb_id,
        kbUploadToken,
        setKbUploadStatus,
      );
      await refreshKbDocs(kbUploadDialog.kb_id);
      setKbUploadDialog(null);
      setKbUploadToken("");
      setKbUploadFile(null);
      setKbUploadStatus("");
    } catch (e: any) {
      const msg = e.message ?? "Upload failed. Check your write token.";
      setKbUploadError(msg.includes("409") ? `Duplicate: ${msg.split("Duplicate:").pop()?.trim() ?? msg}` : msg);
    } finally {
      setKbUploading(false);
    }
  };

  const handleLeave = async () => {
    try {
      await deleteSession(sessionId);
    } catch {}
    onLeave();
  };

  const toggleSources = (idx: number) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleDownload = () => {
    const modeName = modes.find((m) => m.id === modeId)?.label ?? modeId;
    const lines: string[] = [
      "# Chat Export",
      "",
      `- **Session:** ${initialSession.label}`,
      `- **Mode:** ${modeName}`,
      ...(kbEntries.length > 0
        ? [`- **Knowledge Bases:** ${kbEntries.map((e) => e.name).join(", ")}`]
        : []),
      `- **Exported:** ${new Date().toLocaleString()}`,
      "",
      "---",
      "",
    ];
    messages.forEach((msg, idx) => {
      if (msg.role === "user") {
        lines.push("## 🧑 User", "", msg.content, "");
      } else {
        const label =
          models.find((m) => m.id === msg.modelId)?.label ??
          msg.modelId ??
          "unknown";
        lines.push("## 🤖 Assistant", "", `> **Model:** ${label}`);
        lines.push(
          msg.searchEnabled
            ? "> 🔍 Retrieved from documents"
            : "> 💬 Answered from model knowledge",
        );
        lines.push("", msg.content, "");
        if (msg.sources?.length) {
          lines.push(`### Sources (${msg.sources.length})`, "");
          msg.sources.forEach((src, si) => {
            const title = src.title ?? "Untitled";
            const page = src.page ? ` — p.${src.page}` : "";
            const section = src.section ? ` — ${src.section}` : "";
            lines.push(
              `**[${si + 1}] ${title}${page}${section}** *(relevance: ${(src.score * 100).toFixed(0)}%)*`,
              "",
            );
            src.text.split("\n").forEach((l) => lines.push(`> ${l}`));
            lines.push("");
          });
        }
      }
      if (idx < messages.length - 1) lines.push("---", "");
    });
    const blob = new Blob([lines.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${initialSession.label.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            borderRight: "1px solid",
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2 }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ mb: 1.5 }}
          >
            <IconButton size="small" onClick={handleLeave}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography
              variant="body2"
              fontWeight={600}
              noWrap
              sx={{ flex: 1 }}
            >
              {initialSession.label}
            </Typography>
            <Tooltip title="Download chat history">
              <span>
                <IconButton
                  size="small"
                  onClick={handleDownload}
                  disabled={messages.length === 0}
                >
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
            <InputLabel>Mode</InputLabel>
            <Select
              value={modeId}
              label="Mode"
              onChange={(e) => handleModeChange(e.target.value)}
            >
              {modes.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  <Stack>
                    <Typography variant="body2">{m.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {m.description}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Model</InputLabel>
            <Select
              value={modelId}
              label="Model"
              onChange={(e) => handleModelChange(e.target.value)}
            >
              {models.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  <Stack>
                    <Typography variant="body2">{m.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {m.model}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider />

        {/* Scrollable doc area */}
        <Box sx={{ flex: 1, overflow: "auto" }}>
          {/* ── Knowledge Bases ── */}
          <Box sx={{ p: 1.5 }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ px: 1, mb: 0.5 }}
            >
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <FolderOpenIcon
                  sx={{ fontSize: 12, color: "text.secondary" }}
                />
                <Typography variant="caption" color="text.secondary">
                  KNOWLEDGE BASES ({kbEntries.length})
                </Typography>
              </Stack>
              <Tooltip title="Attach a Knowledge Base">
                <Button
                  size="small"
                  sx={{ fontSize: 10, minWidth: 0, px: 1, py: 0 }}
                  onClick={handleOpenAddKb}
                >
                  + Add
                </Button>
              </Tooltip>
            </Stack>

            {kbEntries.length === 0 && (
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ px: 1 }}
              >
                No knowledge bases attached.
              </Typography>
            )}

            {kbEntries.map((entry) => (
              <Box
                key={entry.kb_id}
                sx={{
                  mb: 0.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  opacity: entry.enabled ? 1 : 0.45,
                }}
              >
                {/* KB header row */}
                <Stack
                  direction="row"
                  alignItems="center"
                  sx={{ px: 1, py: 0.5 }}
                >
                  <IconButton
                    size="small"
                    onClick={() => handleToggleKbExpand(entry.kb_id)}
                    sx={{ p: 0.25 }}
                  >
                    {entry.expanded ? (
                      <ExpandLessIcon sx={{ fontSize: 14 }} />
                    ) : (
                      <ExpandMoreIcon sx={{ fontSize: 14 }} />
                    )}
                  </IconButton>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    noWrap
                    sx={{ flex: 1, ml: 0.5 }}
                  >
                    {entry.name}
                  </Typography>
                  <Tooltip title={entry.enabled ? "Disable KB" : "Enable KB"}>
                    <Switch
                      size="small"
                      checked={entry.enabled}
                      onChange={(_, checked) =>
                        handleToggleKb(entry.kb_id, checked)
                      }
                      sx={{ transform: "scale(0.7)", mx: -0.5 }}
                    />
                  </Tooltip>
                  <Tooltip title="Detach KB from session">
                    <IconButton
                      size="small"
                      onClick={() => handleDetachKb(entry.kb_id)}
                      sx={{ p: 0.25 }}
                    >
                      <LinkOffIcon
                        sx={{ fontSize: 13, color: "text.disabled" }}
                      />
                    </IconButton>
                  </Tooltip>
                </Stack>

                {/* KB doc list */}
                <Collapse in={entry.expanded}>
                  <Divider />
                  <List dense disablePadding>
                    {entry.docs.length === 0 && (
                      <ListItem>
                        <ListItemText
                          primary="No documents"
                          primaryTypographyProps={{
                            variant: "caption",
                            color: "text.disabled",
                          }}
                        />
                      </ListItem>
                    )}
                    {entry.docs.map((doc) => {
                      const isDisabled = disabledDocIds.has(doc.doc_id);
                      return (
                        <ListItem
                          key={doc.doc_id}
                          disablePadding
                          sx={{ px: 1, pr: 7, opacity: isDisabled ? 0.45 : 1 }}
                          secondaryAction={
                            <Stack direction="row" spacing={0}>
                              <Tooltip
                                title={
                                  isDisabled
                                    ? "Enable document"
                                    : "Disable document"
                                }
                              >
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    handleToggleDoc(doc.doc_id, isDisabled)
                                  }
                                  sx={{ p: 0.25 }}
                                >
                                  {isDisabled ? (
                                    <VisibilityOffIcon
                                      sx={{
                                        fontSize: 13,
                                        color: "text.disabled",
                                      }}
                                    />
                                  ) : (
                                    <VisibilityIcon
                                      sx={{
                                        fontSize: 13,
                                        color: "text.secondary",
                                      }}
                                    />
                                  )}
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete from KB (requires write token)">
                                <IconButton
                                  size="small"
                                  sx={{ p: 0.25 }}
                                  onClick={() => {
                                    setKbDeleteDialog({
                                      doc,
                                      kb_id: entry.kb_id,
                                    });
                                    setKbDeleteToken("");
                                    setKbDeleteError(null);
                                  }}
                                >
                                  <LockIcon
                                    sx={{
                                      fontSize: 13,
                                      color: "text.disabled",
                                    }}
                                  />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          }
                        >
                          <ListItemText
                            primary={doc.title}
                            secondary={`${doc.chunk_count} chunks`}
                            primaryTypographyProps={{
                              variant: "caption",
                              noWrap: true,
                            }}
                            secondaryTypographyProps={{ variant: "caption" }}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                  <Box sx={{ px: 1, pb: 1 }}>
                    <Tooltip title="Upload a file to this knowledge base (requires write token)">
                      <Button
                        fullWidth
                        size="small"
                        variant="outlined"
                        startIcon={<UploadFileIcon sx={{ fontSize: 13 }} />}
                        onClick={() => {
                          setKbUploadDialog({
                            kb_id: entry.kb_id,
                            kb_name: entry.name,
                          });
                          setKbUploadToken("");
                          setKbUploadFile(null);
                          setKbUploadError(null);
                          setKbUploadStatus("");
                        }}
                        sx={{ fontSize: 10, py: 0.5 }}
                      >
                        Upload to KB
                      </Button>
                    </Tooltip>
                  </Box>
                </Collapse>
              </Box>
            ))}
          </Box>

          <Divider />

          {/* ── Session Documents ── */}
          <Box sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
              SESSION DOCUMENTS ({sessionDocs.length})
            </Typography>
            <List dense disablePadding sx={{ mt: 0.5 }}>
              {sessionDocs.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary="No documents"
                    primaryTypographyProps={{
                      variant: "caption",
                      color: "text.secondary",
                    }}
                  />
                </ListItem>
              )}
              {sessionDocs.map((doc) => {
                const isDisabled = disabledDocIds.has(doc.doc_id);
                return (
                  <ListItem
                    key={doc.doc_id}
                    disablePadding
                    sx={{ pr: 7, opacity: isDisabled ? 0.45 : 1 }}
                    secondaryAction={
                      <Stack direction="row" spacing={0}>
                        <Tooltip
                          title={
                            isDisabled ? "Enable document" : "Disable document"
                          }
                        >
                          <IconButton
                            size="small"
                            onClick={() =>
                              handleToggleDoc(doc.doc_id, isDisabled)
                            }
                            sx={{ p: 0.25 }}
                          >
                            {isDisabled ? (
                              <VisibilityOffIcon
                                sx={{ fontSize: 13, color: "text.disabled" }}
                              />
                            ) : (
                              <VisibilityIcon
                                sx={{ fontSize: 13, color: "text.secondary" }}
                              />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete document">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteSessionDoc(doc)}
                            sx={{ p: 0.25 }}
                          >
                            <DeleteOutlineIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    }
                  >
                    <ListItemText
                      primary={doc.title}
                      secondary={`${doc.chunk_count} chunks`}
                      primaryTypographyProps={{
                        variant: "caption",
                        noWrap: true,
                      }}
                      secondaryTypographyProps={{ variant: "caption" }}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Box>
        </Box>

        <Divider />

        {/* Save to KB button */}
        {sessionDocs.length > 0 && (
          <Box sx={{ px: 1.5, pt: 1.5 }}>
            <Tooltip title="Save all session documents into a new persistent Knowledge Base">
              <Button
                fullWidth
                size="small"
                variant="outlined"
                startIcon={<SaveIcon fontSize="small" />}
                onClick={() => {
                  setExportName("");
                  setExportDescription("");
                  setExportResult(null);
                  setExportError(null);
                  setExportDialog(true);
                }}
                sx={{ fontSize: 11, py: 0.75 }}
              >
                Save to Knowledge Base
              </Button>
            </Tooltip>
          </Box>
        )}

        {/* Upload area */}
        <Box
          sx={{
            m: 1.5,
            p: 2,
            border: "1px dashed",
            borderColor: dragOver ? "primary.main" : "divider",
            borderRadius: 1,
            cursor: "pointer",
            textAlign: "center",
            transition: "border-color 0.2s",
            bgcolor: dragOver ? "action.hover" : "transparent",
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleUpload(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.md"
            style={{ display: "none" }}
            onChange={(e) => handleUpload(e.target.files)}
          />
          {uploading ? (
            <Stack alignItems="center" spacing={0.5}>
              <CircularProgress size={18} />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ maxWidth: 200, wordBreak: "break-all" }}
              >
                {uploadStatus || "Processing…"}
              </Typography>
            </Stack>
          ) : (
            <Stack alignItems="center" spacing={0.5}>
              <UploadFileIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                Drop files or click to upload
              </Typography>
              <Typography variant="caption" color="text.secondary">
                PDF, TXT, MD — session only
              </Typography>
            </Stack>
          )}
        </Box>
      </Drawer>

      {/* ── Chat area ────────────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box sx={{ flex: 1, overflow: "auto", p: 3 }}>
          <Stack spacing={2} sx={{ maxWidth: 720, mx: "auto" }}>
            {messages.length === 0 && (
              <Box sx={{ textAlign: "center", mt: 8 }}>
                <Typography color="text.secondary" variant="body2">
                  {kbEntries.length > 0
                    ? `${kbEntries.length} KB${kbEntries.length > 1 ? "s" : ""} attached. Ask questions or upload additional documents.`
                    : "Start by uploading documents, then ask questions."}
                </Typography>
              </Box>
            )}

            {messages.map((msg, idx) => (
              <Box key={idx}>
                <Stack
                  direction="row"
                  justifyContent={
                    msg.role === "user" ? "flex-end" : "flex-start"
                  }
                >
                  <Box
                    sx={{
                      maxWidth: "80%",
                      px: 2,
                      py: 1.5,
                      borderRadius: 2,
                      bgcolor:
                        msg.role === "user"
                          ? "primary.main"
                          : "background.paper",
                      border: msg.role === "assistant" ? "1px solid" : "none",
                      borderColor: "divider",
                    }}
                  >
                    {msg.role === "assistant" ? (
                      <MarkdownContent content={msg.content} />
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{ whiteSpace: "pre-wrap" }}
                      >
                        {msg.content}
                      </Typography>
                    )}
                  </Box>
                </Stack>

                {msg.role === "assistant" && (
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ mt: 0.5, ml: 0.5 }}
                  >
                    {msg.modelId && (
                      <Typography variant="caption" color="text.disabled">
                        {models.find((m) => m.id === msg.modelId)?.label ??
                          msg.modelId}
                      </Typography>
                    )}
                    <Tooltip
                      title={
                        msg.searchEnabled
                          ? "Grounded in retrieved documents"
                          : "Answered from model knowledge"
                      }
                    >
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        {msg.searchEnabled ? (
                          <SearchIcon
                            sx={{ fontSize: 13, color: "primary.main" }}
                          />
                        ) : (
                          <SearchOffIcon
                            sx={{ fontSize: 13, color: "text.disabled" }}
                          />
                        )}
                      </Box>
                    </Tooltip>
                    {msg.sources && msg.sources.length > 0 && (
                      <Button
                        size="small"
                        startIcon={
                          expandedSources.has(idx) ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )
                        }
                        onClick={() => toggleSources(idx)}
                        sx={{
                          color: "text.secondary",
                          fontSize: 11,
                          minWidth: 0,
                        }}
                      >
                        {msg.sources.length} source
                        {msg.sources.length > 1 ? "s" : ""}
                      </Button>
                    )}
                  </Stack>
                )}

                {msg.role === "assistant" &&
                  msg.sources &&
                  msg.sources.length > 0 && (
                    <Collapse in={expandedSources.has(idx)}>
                      <Stack spacing={1} sx={{ mt: 1, ml: 0.5 }}>
                        {msg.sources.map((src, si) => (
                          <Box
                            key={si}
                            sx={{
                              p: 1.5,
                              borderRadius: 1,
                              bgcolor: "background.paper",
                              border: "1px solid",
                              borderColor: "divider",
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              sx={{ mb: 0.5 }}
                            >
                              <AttachFileIcon
                                sx={{ fontSize: 12, color: "text.secondary" }}
                              />
                              <Typography variant="caption" fontWeight={600}>
                                {src.title ?? "Untitled"}
                              </Typography>
                              {src.page && (
                                <Chip
                                  label={`p.${src.page}`}
                                  size="small"
                                  sx={{ height: 16, fontSize: 10 }}
                                />
                              )}
                              <Chip
                                label={`${(src.score * 100).toFixed(0)}%`}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ height: 16, fontSize: 10 }}
                              />
                            </Stack>
                            {src.section && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                display="block"
                                sx={{ mb: 0.5 }}
                              >
                                {src.section}
                              </Typography>
                            )}
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                fontFamily: "monospace",
                                lineHeight: 1.6,
                              }}
                            >
                              {src.text}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Collapse>
                  )}
              </Box>
            ))}

            {loading && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={14} />
                <Typography variant="caption" color="text.secondary">
                  {willSearch ? "Searching & thinking…" : "Thinking…"}
                </Typography>
              </Stack>
            )}
            {error && (
              <Alert
                severity={error.startsWith("Duplicate:") ? "warning" : "error"}
                onClose={() => setError(null)}
                sx={{ fontSize: 12 }}
              >
                {error}
              </Alert>
            )}
            <div ref={bottomRef} />
          </Stack>
        </Box>

        {/* Input bar */}
        <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <Stack spacing={1} sx={{ maxWidth: 720, mx: "auto" }}>
            {willSearch && (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
              >
                <Typography variant="caption" color="text.secondary">
                  Retrieve
                </Typography>
                {TOP_K_PRESETS.map((k) => (
                  <Chip
                    key={k}
                    label={`${k}`}
                    size="small"
                    variant={topK === k && !customTopK ? "filled" : "outlined"}
                    color={topK === k && !customTopK ? "primary" : "default"}
                    onClick={() => {
                      setTopK(k);
                      setCustomTopK("");
                    }}
                    sx={{ cursor: "pointer", fontSize: 11 }}
                  />
                ))}
                <TextField
                  size="small"
                  placeholder="custom"
                  value={customTopK}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d+$/.test(v)) setCustomTopK(v);
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Typography variant="caption" color="text.secondary">
                          chunks
                        </Typography>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ width: 130 }}
                  inputProps={{ style: { fontSize: 12, padding: "4px 6px" } }}
                />
                {currentMode?.force_search && (
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{ ml: 0.5 }}
                  >
                    (always on in {currentMode.label} mode)
                  </Typography>
                )}
              </Stack>
            )}
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <TextField
                fullWidth
                multiline
                maxRows={5}
                size="small"
                placeholder="Ask a question…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={loading}
              />
              {!currentMode?.force_search && (
                <Tooltip
                  title={
                    searchEnabled
                      ? "Search ON — click to disable"
                      : "Search OFF — click to enable"
                  }
                >
                  <IconButton
                    onClick={() => setSearchEnabled((v) => !v)}
                    color={searchEnabled ? "primary" : "default"}
                    size="small"
                    sx={{
                      border: "1px solid",
                      borderColor: searchEnabled ? "primary.main" : "divider",
                      borderRadius: 1,
                      mb: 0.25,
                    }}
                  >
                    {searchEnabled ? (
                      <SearchIcon fontSize="small" />
                    ) : (
                      <SearchOffIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              )}
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={loading || !input.trim()}
              >
                <SendIcon />
              </IconButton>
            </Stack>
          </Stack>
        </Box>
      </Box>

      {/* ── Add to KB dialog ──────────────────────────────────────────── */}
      <Dialog
        open={kbUploadDialog !== null}
        onClose={() => {
          if (!kbUploading) {
            setKbUploadDialog(null);
            setKbUploadFile(null);
            setKbUploadToken("");
            setKbUploadError(null);
          }
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Add to {kbUploadDialog?.kb_name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Write token"
              type="password"
              size="small"
              fullWidth
              value={kbUploadToken}
              onChange={(e) => {
                setKbUploadToken(e.target.value);
                setKbUploadError(null);
              }}
              autoFocus
              helperText="Required to add documents to this knowledge base."
            />
            {/* File drop zone */}
            <Box
              sx={{
                p: 2,
                border: "1px dashed",
                borderColor: kbUploadDrag ? "primary.main" : "divider",
                borderRadius: 1,
                textAlign: "center",
                cursor: "pointer",
                bgcolor: kbUploadDrag ? "action.hover" : "transparent",
                transition: "border-color 0.2s",
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setKbUploadDrag(true);
              }}
              onDragLeave={() => setKbUploadDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setKbUploadDrag(false);
                const f = e.dataTransfer.files[0];
                if (f) setKbUploadFile(f);
              }}
              onClick={() => kbFileInputRef.current?.click()}
            >
              <input
                ref={kbFileInputRef}
                type="file"
                accept=".pdf,.txt,.md"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setKbUploadFile(f);
                }}
              />
              {kbUploadFile ? (
                <Stack alignItems="center" spacing={0.5}>
                  <AttachFileIcon fontSize="small" color="primary" />
                  <Typography variant="caption" fontWeight={600}>
                    {kbUploadFile.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(kbUploadFile.size / 1024).toFixed(0)} KB — click to change
                  </Typography>
                </Stack>
              ) : (
                <Stack alignItems="center" spacing={0.5}>
                  <UploadFileIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    Drop a file or click to browse
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    PDF, TXT, MD
                  </Typography>
                </Stack>
              )}
            </Box>
            {kbUploading && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={14} />
                <Typography variant="caption" color="text.secondary">
                  {kbUploadStatus || "Processing…"}
                </Typography>
              </Stack>
            )}
            {kbUploadError && (
              <Alert severity={kbUploadError.startsWith("Duplicate:") ? "warning" : "error"} sx={{ fontSize: 12 }}>
                {kbUploadError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setKbUploadDialog(null);
              setKbUploadFile(null);
              setKbUploadToken("");
              setKbUploadError(null);
            }}
            disabled={kbUploading}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleKbUpload}
            disabled={!kbUploadFile || !kbUploadToken || kbUploading}
          >
            {kbUploading ? "Uploading…" : "Upload"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add KB dialog ─────────────────────────────────────────────────── */}
      <Dialog
        open={addKbDialog}
        onClose={() => setAddKbDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Attach Knowledge Base</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Knowledge Base</InputLabel>
              <Select
                value={addKbId}
                label="Knowledge Base"
                onChange={(e) => setAddKbId(e.target.value)}
              >
                {availableKbs.length === 0 && (
                  <MenuItem disabled>
                    <Typography variant="caption" color="text.secondary">
                      No other knowledge bases available
                    </Typography>
                  </MenuItem>
                )}
                {availableKbs.map((kb) => (
                  <MenuItem key={kb.kb_id} value={kb.kb_id}>
                    <Stack>
                      <Typography variant="body2">{kb.name}</Typography>
                      {kb.description && (
                        <Typography variant="caption" color="text.secondary">
                          {kb.description}
                        </Typography>
                      )}
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddKbDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddKb}
            disabled={!addKbId || addKbLoading}
          >
            {addKbLoading ? "Attaching…" : "Attach"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── KB delete dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={kbDeleteDialog !== null}
        onClose={() => {
          setKbDeleteDialog(null);
          setKbDeleteToken("");
          setKbDeleteError(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete from Knowledge Base</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2">
              You are about to permanently delete{" "}
              <strong>{kbDeleteDialog?.doc.title}</strong>. This affects all
              sessions using this KB.
            </Typography>
            <TextField
              label="Write token"
              type="password"
              size="small"
              fullWidth
              value={kbDeleteToken}
              onChange={(e) => {
                setKbDeleteToken(e.target.value);
                setKbDeleteError(null);
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && kbDeleteToken) handleKbDeleteConfirm();
              }}
              helperText="The write token issued when this knowledge base was created."
            />
            {kbDeleteError && (
              <Alert severity="error" sx={{ fontSize: 12 }}>
                {kbDeleteError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setKbDeleteDialog(null);
              setKbDeleteToken("");
              setKbDeleteError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleKbDeleteConfirm}
            disabled={!kbDeleteToken || kbDeleting}
          >
            {kbDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Export to KB dialog ───────────────────────────────────────────── */}
      <Dialog
        open={exportDialog}
        onClose={handleExportClose}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Save to Knowledge Base</DialogTitle>
        <DialogContent>
          {!exportResult ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                All {sessionDocs.length} document
                {sessionDocs.length > 1 ? "s" : ""} will be copied into a new
                persistent KB. Embeddings are reused — no re-processing.
              </Typography>
              <TextField
                label="Knowledge Base name"
                size="small"
                fullWidth
                required
                value={exportName}
                onChange={(e) => setExportName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && exportName.trim())
                    handleExportToKb();
                }}
              />
              <TextField
                label="Description (optional)"
                size="small"
                fullWidth
                value={exportDescription}
                onChange={(e) => setExportDescription(e.target.value)}
              />
              {exportError && (
                <Alert severity="error" sx={{ fontSize: 12 }}>
                  {exportError}
                </Alert>
              )}
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity="success" sx={{ fontSize: 12 }}>
                <strong>{exportResult.name}</strong> created with{" "}
                {exportResult.chunks_copied} chunks.
              </Alert>
              <Typography variant="body2" color="text.secondary">
                Store your write token securely — shown only once.
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: "background.default",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  fontFamily: "monospace",
                  fontSize: 11,
                  wordBreak: "break-all",
                }}
              >
                {exportResult.write_token}
              </Box>
              <Button
                size="small"
                startIcon={<ContentCopyIcon fontSize="small" />}
                onClick={handleCopyToken}
                variant={tokenCopied ? "contained" : "outlined"}
                color={tokenCopied ? "success" : "primary"}
                sx={{ alignSelf: "flex-start" }}
              >
                {tokenCopied ? "Copied!" : "Copy token"}
              </Button>
              <Typography variant="caption" color="text.secondary">
                KB ID: <code>{exportResult.kb_id}</code>
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {!exportResult ? (
            <>
              <Button onClick={handleExportClose}>Cancel</Button>
              <Button
                variant="contained"
                onClick={handleExportToKb}
                disabled={!exportName.trim() || exporting}
              >
                {exporting ? "Exporting…" : "Save"}
              </Button>
            </>
          ) : (
            <Button variant="contained" onClick={handleExportClose}>
              Done
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
