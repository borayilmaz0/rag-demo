import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import MarkdownContent from "./MarkdownContent";
import type { ModelConfig } from "../api";
import type { Message } from "../hooks/useChat";

interface Props {
  messages: Message[];
  loading: boolean;
  error: string | null;
  willSearch: boolean;
  models: ModelConfig[];
  expandedSources: Set<number>;
  onToggleSources: (idx: number) => void;
  onDismissError: () => void;
  bottomRef: React.RefObject<HTMLDivElement>;
  kbCount: number;
}

export default function ChatArea({
  messages,
  loading,
  error,
  willSearch,
  models,
  expandedSources,
  onToggleSources,
  onDismissError,
  bottomRef,
  kbCount,
}: Props) {
  return (
    <Box sx={{ flex: 1, overflow: "auto", p: 3 }}>
      <Stack spacing={2} sx={{ maxWidth: 720, mx: "auto" }}>
        {messages.length === 0 && (
          <Box sx={{ textAlign: "center", mt: 8 }}>
            <Typography color="text.secondary" variant="body2">
              {kbCount > 0
                ? `${kbCount} KB${kbCount > 1 ? "s" : ""} attached. Ask questions or upload additional documents.`
                : "Start by uploading documents, then ask questions."}
            </Typography>
          </Box>
        )}

        {messages.map((msg, idx) => (
          <Box key={idx}>
            <Stack direction="row" justifyContent={msg.role === "user" ? "flex-end" : "flex-start"}>
              <Box
                sx={{
                  maxWidth: "80%",
                  px: 2,
                  py: 1.5,
                  borderRadius: 2,
                  bgcolor: msg.role === "user" ? "primary.main" : "background.paper",
                  border: msg.role === "assistant" ? "1px solid" : "none",
                  borderColor: "divider",
                }}
              >
                {msg.role === "assistant" ? (
                  <MarkdownContent content={msg.content} />
                ) : (
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {msg.content}
                  </Typography>
                )}
              </Box>
            </Stack>

            {msg.role === "assistant" && (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5, ml: 0.5 }}>
                {msg.modelId && (
                  <Typography variant="caption" color="text.disabled">
                    {models.find((m) => m.id === msg.modelId)?.label ?? msg.modelId}
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
                      <SearchIcon sx={{ fontSize: 13, color: "primary.main" }} />
                    ) : (
                      <SearchOffIcon sx={{ fontSize: 13, color: "text.disabled" }} />
                    )}
                  </Box>
                </Tooltip>
                {msg.sources && msg.sources.length > 0 && (
                  <Button
                    size="small"
                    startIcon={expandedSources.has(idx) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    onClick={() => onToggleSources(idx)}
                    sx={{ color: "text.secondary", fontSize: 11, minWidth: 0 }}
                  >
                    {msg.sources.length} source{msg.sources.length > 1 ? "s" : ""}
                  </Button>
                )}
              </Stack>
            )}

            {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
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
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <AttachFileIcon sx={{ fontSize: 12, color: "text.secondary" }} />
                        <Typography variant="caption" fontWeight={600}>
                          {src.title ?? "Untitled"}
                        </Typography>
                        {src.page && (
                          <Chip label={`p.${src.page}`} size="small" sx={{ height: 16, fontSize: 10 }} />
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
            onClose={onDismissError}
            sx={{ fontSize: 12 }}
          >
            {error}
          </Alert>
        )}

        <div ref={bottomRef} />
      </Stack>
    </Box>
  );
}
