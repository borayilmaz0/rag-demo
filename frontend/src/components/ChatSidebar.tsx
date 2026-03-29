import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SaveIcon from "@mui/icons-material/Save";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import KbEntryRow from "./KbEntryRow";
import type { Doc, ModeConfig, ModelConfig } from "../api";
import type { KbEntry } from "../hooks/useKbManager";
import type { Message } from "../hooks/useChat";

export const DRAWER_WIDTH = 300;

interface Props {
  label: string;
  modeId: string;
  modelId: string;
  modes: ModeConfig[];
  models: ModelConfig[];
  onModeChange: (id: string) => void;
  onModelChange: (id: string) => void;
  onLeave: () => void;
  onDownload: () => void;
  messages: Message[];
  // KB
  kbEntries: KbEntry[];
  onOpenAddKb: () => void;
  onToggleKb: (kb_id: string, enabled: boolean) => void;
  onDetachKb: (kb_id: string) => void;
  onExpandKb: (kb_id: string) => void;
  onOpenKbUpload: (kb_id: string, kb_name: string) => void;
  onOpenKbDelete: (doc: Doc, kb_id: string) => void;
  // Session docs
  sessionDocs: Doc[];
  disabledDocIds: Set<string>;
  onToggleDoc: (doc_id: string, enabled: boolean) => void;
  onDeleteSessionDoc: (doc: Doc) => void;
  onExportOpen: () => void;
  // Upload zone
  uploading: boolean;
  uploadStatus: string;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onUpload: (files: FileList | null) => void;
}

export default function ChatSidebar({
  label,
  modeId,
  modelId,
  modes,
  models,
  onModeChange,
  onModelChange,
  onLeave,
  onDownload,
  messages,
  kbEntries,
  onOpenAddKb,
  onToggleKb,
  onDetachKb,
  onExpandKb,
  onOpenKbUpload,
  onOpenKbDelete,
  sessionDocs,
  disabledDocIds,
  onToggleDoc,
  onDeleteSessionDoc,
  onExportOpen,
  uploading,
  uploadStatus,
  dragOver,
  setDragOver,
  fileInputRef,
  onUpload,
}: Props) {
  return (
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
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <IconButton size="small" onClick={onLeave}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
            {label}
          </Typography>
          <Tooltip title="Download chat history">
            <span>
              <IconButton size="small" onClick={onDownload} disabled={messages.length === 0}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel>Mode</InputLabel>
          <Select value={modeId} label="Mode" onChange={(e) => onModeChange(e.target.value)}>
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
          <Select value={modelId} label="Model" onChange={(e) => onModelChange(e.target.value)}>
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
      </Box>

      <Divider />

      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {/* Knowledge Bases */}
        <Box sx={{ p: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1, mb: 0.5 }}>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <FolderOpenIcon sx={{ fontSize: 12, color: "text.secondary" }} />
              <Typography variant="caption" color="text.secondary">
                KNOWLEDGE BASES ({kbEntries.length})
              </Typography>
            </Stack>
            <Tooltip title="Attach a Knowledge Base">
              <Button size="small" sx={{ fontSize: 10, minWidth: 0, px: 1, py: 0 }} onClick={onOpenAddKb}>
                + Add
              </Button>
            </Tooltip>
          </Stack>

          {kbEntries.length === 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ px: 1 }}>
              No knowledge bases attached.
            </Typography>
          )}

          {kbEntries.map((entry) => (
            <KbEntryRow
              key={entry.kb_id}
              entry={entry}
              disabledDocIds={disabledDocIds}
              onToggle={onToggleKb}
              onDetach={onDetachKb}
              onExpand={onExpandKb}
              onToggleDoc={onToggleDoc}
              onOpenDeleteDialog={onOpenKbDelete}
              onOpenUploadDialog={onOpenKbUpload}
            />
          ))}
        </Box>

        <Divider />

        {/* Session Documents */}
        <Box sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
            SESSION DOCUMENTS ({sessionDocs.length})
          </Typography>
          <List dense disablePadding sx={{ mt: 0.5 }}>
            {sessionDocs.length === 0 && (
              <ListItem>
                <ListItemText
                  primary="No documents"
                  primaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
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
                      <Tooltip title={isDisabled ? "Enable document" : "Disable document"}>
                        <IconButton
                          size="small"
                          onClick={() => onToggleDoc(doc.doc_id, isDisabled)}
                          sx={{ p: 0.25 }}
                        >
                          {isDisabled ? (
                            <VisibilityOffIcon sx={{ fontSize: 13, color: "text.disabled" }} />
                          ) : (
                            <VisibilityIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete document">
                        <IconButton size="small" onClick={() => onDeleteSessionDoc(doc)} sx={{ p: 0.25 }}>
                          <DeleteOutlineIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={doc.title}
                    secondary={`${doc.chunk_count} chunks`}
                    primaryTypographyProps={{ variant: "caption", noWrap: true }}
                    secondaryTypographyProps={{ variant: "caption" }}
                  />
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Box>

      <Divider />

      {/* Export button */}
      {sessionDocs.length > 0 && (
        <Box sx={{ px: 1.5, pt: 1.5 }}>
          <Tooltip title="Save all session documents into a new persistent Knowledge Base">
            <Button
              fullWidth
              size="small"
              variant="outlined"
              startIcon={<SaveIcon fontSize="small" />}
              onClick={onExportOpen}
              sx={{ fontSize: 11, py: 0.75 }}
            >
              Save to Knowledge Base
            </Button>
          </Tooltip>
        </Box>
      )}

      {/* Upload zone */}
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
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onUpload(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md"
          style={{ display: "none" }}
          onChange={(e) => onUpload(e.target.files)}
        />
        {uploading ? (
          <Stack alignItems="center" spacing={0.5}>
            <CircularProgress size={18} />
            <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 200, wordBreak: "break-all" }}>
              {uploadStatus || "Processing…"}
            </Typography>
          </Stack>
        ) : (
          <Stack alignItems="center" spacing={0.5}>
            <UploadFileIcon fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary">Drop files or click to upload</Typography>
            <Typography variant="caption" color="text.secondary">PDF, TXT, MD — session only</Typography>
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
