import {
  Box,
  Button,
  Collapse,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import LockIcon from "@mui/icons-material/Lock";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import type { Doc } from "../api";
import type { KbEntry } from "../hooks/useKbManager";

interface Props {
  entry: KbEntry;
  disabledDocIds: Set<string>;
  onToggle: (kb_id: string, enabled: boolean) => void;
  onDetach: (kb_id: string) => void;
  onExpand: (kb_id: string) => void;
  onToggleDoc: (doc_id: string, enabled: boolean) => void;
  onOpenDeleteDialog: (doc: Doc, kb_id: string) => void;
  onOpenUploadDialog: (kb_id: string, kb_name: string) => void;
}

export default function KbEntryRow({
  entry,
  disabledDocIds,
  onToggle,
  onDetach,
  onExpand,
  onToggleDoc,
  onOpenDeleteDialog,
  onOpenUploadDialog,
}: Props) {
  return (
    <Box
      sx={{
        mb: 0.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        opacity: entry.enabled ? 1 : 0.45,
      }}
    >
      <Stack direction="row" alignItems="center" sx={{ px: 1, py: 0.5 }}>
        <IconButton size="small" onClick={() => onExpand(entry.kb_id)} sx={{ p: 0.25 }}>
          {entry.expanded ? (
            <ExpandLessIcon sx={{ fontSize: 14 }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 14 }} />
          )}
        </IconButton>
        <Typography variant="caption" fontWeight={600} noWrap sx={{ flex: 1, ml: 0.5 }}>
          {entry.name}
        </Typography>
        <Tooltip title={entry.enabled ? "Disable KB" : "Enable KB"}>
          <Switch
            size="small"
            checked={entry.enabled}
            onChange={(_, checked) => onToggle(entry.kb_id, checked)}
            sx={{ transform: "scale(0.7)", mx: -0.5 }}
          />
        </Tooltip>
        <Tooltip title="Detach KB from session">
          <IconButton size="small" onClick={() => onDetach(entry.kb_id)} sx={{ p: 0.25 }}>
            <LinkOffIcon sx={{ fontSize: 13, color: "text.disabled" }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <Collapse in={entry.expanded}>
        <Divider />
        <List dense disablePadding>
          {entry.docs.length === 0 && (
            <ListItem>
              <ListItemText
                primary="No documents"
                primaryTypographyProps={{ variant: "caption", color: "text.disabled" }}
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
                    <Tooltip title="Delete from KB (requires write token)">
                      <IconButton
                        size="small"
                        sx={{ p: 0.25 }}
                        onClick={() => onOpenDeleteDialog(doc, entry.kb_id)}
                      >
                        <LockIcon sx={{ fontSize: 13, color: "text.disabled" }} />
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
        <Box sx={{ px: 1, pb: 1 }}>
          <Tooltip title="Upload a file to this knowledge base (requires write token)">
            <Button
              fullWidth
              size="small"
              variant="outlined"
              startIcon={<UploadFileIcon sx={{ fontSize: 13 }} />}
              onClick={() => onOpenUploadDialog(entry.kb_id, entry.name)}
              sx={{ fontSize: 10, py: 0.5 }}
            >
              Upload to KB
            </Button>
          </Tooltip>
        </Box>
      </Collapse>
    </Box>
  );
}
