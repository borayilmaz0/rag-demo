import { useState } from "react";
import { deleteKbDocument } from "../api";
import type { Doc } from "../api";

export function useKbDeleteDialog(refreshKbDocs: (kb_id: string) => Promise<void>) {
  const [dialog, setDialog] = useState<{ doc: Doc; kb_id: string } | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const open = (doc: Doc, kb_id: string) => {
    setDialog({ doc, kb_id });
    setToken("");
    setError(null);
  };

  const close = () => {
    setDialog(null);
    setToken("");
    setError(null);
  };

  const handleDelete = async () => {
    if (!dialog) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteKbDocument(dialog.kb_id, dialog.doc.doc_id, token);
      await refreshKbDocs(dialog.kb_id);
      close();
    } catch (e: any) {
      setError(e.message ?? "Delete failed. Check your write token.");
    } finally {
      setDeleting(false);
    }
  };

  return { dialog, token, setToken, error, deleting, open, close, handleDelete };
}
