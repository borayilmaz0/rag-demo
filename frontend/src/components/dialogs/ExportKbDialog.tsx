import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import type { useExportDialog } from "../../hooks/useExportDialog";

interface Props extends ReturnType<typeof useExportDialog> {
  docCount: number;
}

export default function ExportKbDialog({
  open,
  exportName,
  setExportName,
  exportDescription,
  setExportDescription,
  exportResult,
  exportError,
  exporting,
  tokenCopied,
  handleClose,
  handleExport,
  handleCopyToken,
  docCount,
}: Props) {
  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Save to Knowledge Base</DialogTitle>
      <DialogContent>
        {!exportResult ? (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              All {docCount} document{docCount > 1 ? "s" : ""} will be copied into a new
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
              onKeyDown={(e) => { if (e.key === "Enter" && exportName.trim()) handleExport(); }}
            />
            <TextField
              label="Description (optional)"
              size="small"
              fullWidth
              value={exportDescription}
              onChange={(e) => setExportDescription(e.target.value)}
            />
            {exportError && <Alert severity="error" sx={{ fontSize: 12 }}>{exportError}</Alert>}
            {exporting && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={14} />
                <Typography variant="caption" color="text.secondary">Exporting…</Typography>
              </Stack>
            )}
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="success" sx={{ fontSize: 12 }}>
              <strong>{exportResult.name}</strong> created with {exportResult.chunks_copied} chunks.
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
            <Button onClick={handleClose}>Cancel</Button>
            <Button variant="contained" onClick={handleExport} disabled={!exportName.trim() || exporting}>
              Save
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={handleClose}>Done</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
