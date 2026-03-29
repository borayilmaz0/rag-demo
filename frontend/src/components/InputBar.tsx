import {
  Box,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import SendIcon from "@mui/icons-material/Send";
import { TOP_K_PRESETS } from "../api";
import type { ModeConfig } from "../api";

interface Props {
  input: string;
  onInputChange: (v: string) => void;
  loading: boolean;
  searchEnabled: boolean;
  onSearchToggle: () => void;
  currentMode: ModeConfig | undefined;
  topK: number;
  onTopKChange: (k: number) => void;
  customTopK: string;
  onCustomTopKChange: (v: string) => void;
  willSearch: boolean;
  onSend: () => void;
}

export default function InputBar({
  input,
  onInputChange,
  loading,
  searchEnabled,
  onSearchToggle,
  currentMode,
  topK,
  onTopKChange,
  customTopK,
  onCustomTopKChange,
  willSearch,
  onSend,
}: Props) {
  return (
    <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
      <Stack spacing={1} sx={{ maxWidth: 720, mx: "auto" }}>
        {willSearch && (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" color="text.secondary">Retrieve</Typography>
            {TOP_K_PRESETS.map((k) => (
              <Chip
                key={k}
                label={`${k}`}
                size="small"
                variant={topK === k && !customTopK ? "filled" : "outlined"}
                color={topK === k && !customTopK ? "primary" : "default"}
                onClick={() => { onTopKChange(k); onCustomTopKChange(""); }}
                sx={{ cursor: "pointer", fontSize: 11 }}
              />
            ))}
            <TextField
              size="small"
              placeholder="custom"
              value={customTopK}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d+$/.test(v)) onCustomTopKChange(v);
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Typography variant="caption" color="text.secondary">chunks</Typography>
                  </InputAdornment>
                ),
              }}
              sx={{ width: 130 }}
              inputProps={{ style: { fontSize: 12, padding: "4px 6px" } }}
            />
            {currentMode?.force_search && (
              <Typography variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
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
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            disabled={loading}
          />
          {!currentMode?.force_search && (
            <Tooltip title={searchEnabled ? "Search ON — click to disable" : "Search OFF — click to enable"}>
              <IconButton
                onClick={onSearchToggle}
                color={searchEnabled ? "primary" : "default"}
                size="small"
                sx={{
                  border: "1px solid",
                  borderColor: searchEnabled ? "primary.main" : "divider",
                  borderRadius: 1,
                  mb: 0.25,
                }}
              >
                {searchEnabled ? <SearchIcon fontSize="small" /> : <SearchOffIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
          <IconButton color="primary" onClick={onSend} disabled={loading || !input.trim()}>
            <SendIcon />
          </IconButton>
        </Stack>
      </Stack>
    </Box>
  );
}
