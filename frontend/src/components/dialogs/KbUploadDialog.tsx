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
import AttachFileIcon from "@mui/icons-material/AttachFile";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import type { useKbUploadDialog } from "../../hooks/useKbUploadDialog";

type Props = ReturnType<typeof useKbUploadDialog>;

export default function KbUploadDialog({
  dialog,
  token,
  setToken,
  file,
  setFile,
  drag,
  setDrag,
  uploading,
  status,
  error,
  fileInputRef,
  close,
  handleUpload,
}: Props) {
  return (
    <Dialog open={dialog !== null} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle>Add to {dialog?.kb_name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Write token"
            type="password"
            size="small"
            fullWidth
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoFocus
            helperText="Required to add documents to this knowledge base."
          />
          <Box
            sx={{
              p: 2,
              border: "1px dashed",
              borderColor: drag ? "primary.main" : "divider",
              borderRadius: 1,
              textAlign: "center",
              cursor: "pointer",
              bgcolor: drag ? "action.hover" : "transparent",
              transition: "border-color 0.2s",
            }}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f) setFile(f);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }}
            />
            {file ? (
              <Stack alignItems="center" spacing={0.5}>
                <AttachFileIcon fontSize="small" color="primary" />
                <Typography variant="caption" fontWeight={600}>{file.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {(file.size / 1024).toFixed(0)} KB — click to change
                </Typography>
              </Stack>
            ) : (
              <Stack alignItems="center" spacing={0.5}>
                <UploadFileIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">Drop a file or click to browse</Typography>
                <Typography variant="caption" color="text.secondary">PDF, TXT, MD</Typography>
              </Stack>
            )}
          </Box>
          {uploading && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary">
                {status || "Processing…"}
              </Typography>
            </Stack>
          )}
          {error && (
            <Alert severity={error.startsWith("Duplicate:") ? "warning" : "error"} sx={{ fontSize: 12 }}>
              {error}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={uploading}>Cancel</Button>
        <Button variant="contained" onClick={handleUpload} disabled={!file || !token || uploading}>
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
