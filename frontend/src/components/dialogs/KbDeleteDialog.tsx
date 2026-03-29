import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { useKbDeleteDialog } from "../../hooks/useKbDeleteDialog";

type Props = ReturnType<typeof useKbDeleteDialog>;

export default function KbDeleteDialog({ dialog, token, setToken, error, deleting, close, handleDelete }: Props) {
  return (
    <Dialog open={dialog !== null} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle>Delete from Knowledge Base</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2">
            You are about to permanently delete{" "}
            <strong>{dialog?.doc.title}</strong>. This affects all sessions using this KB.
          </Typography>
          <TextField
            label="Write token"
            type="password"
            size="small"
            fullWidth
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && token) handleDelete(); }}
            helperText="The write token issued when this knowledge base was created."
          />
          {error && <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button color="error" variant="contained" onClick={handleDelete} disabled={!token || deleting}>
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
