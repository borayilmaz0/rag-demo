import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import type { KnowledgeBase } from "../../api";

interface Props {
  open: boolean;
  onClose: () => void;
  availableKbs: KnowledgeBase[];
  selectedId: string;
  onSelectId: (id: string) => void;
  onConfirm: () => void;
  loading: boolean;
}

export default function AddKbDialog({
  open,
  onClose,
  availableKbs,
  selectedId,
  onSelectId,
  onConfirm,
  loading,
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Attach Knowledge Base</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Knowledge Base</InputLabel>
            <Select
              value={selectedId}
              label="Knowledge Base"
              onChange={(e) => onSelectId(e.target.value)}
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
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onConfirm} disabled={!selectedId || loading}>
          {loading ? "Attaching…" : "Attach"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
