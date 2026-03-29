import { useState, useRef, useCallback } from "react";
import { listDocuments, uploadFile, deleteDocument, toggleDoc } from "../api";
import type { Doc } from "../api";

export function useDocumentManager(
  sessionId: string,
  setError: (msg: string | null) => void,
) {
  const [sessionDocs, setSessionDocs] = useState<Doc[]>([]);
  const [disabledDocIds, setDisabledDocIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSessionDocs = useCallback(async () => {
    try {
      const res = await listDocuments(sessionId);
      setSessionDocs(res.documents);
    } catch {}
  }, [sessionId]);

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
      setError(
        msg.includes("409")
          ? `Duplicate: ${msg.split("Duplicate:").pop()?.trim() ?? msg}`
          : msg,
      );
    } finally {
      setUploading(false);
      setUploadStatus("");
    }
  };

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

  const handleDeleteSessionDoc = async (doc: Doc) => {
    try {
      await deleteDocument(doc.doc_id, sessionId);
      await refreshSessionDocs();
    } catch (e: any) {
      setError(e.message ?? "Delete failed.");
    }
  };

  return {
    sessionDocs,
    disabledDocIds,
    uploading,
    uploadStatus,
    dragOver,
    setDragOver,
    fileInputRef,
    refreshSessionDocs,
    handleUpload,
    handleToggleDoc,
    handleDeleteSessionDoc,
  };
}
