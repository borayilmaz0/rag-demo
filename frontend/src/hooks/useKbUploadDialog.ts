import { useState, useRef } from "react";
import { uploadFileToKb } from "../api";

export function useKbUploadDialog(refreshKbDocs: (kb_id: string) => Promise<void>) {
  const [dialog, setDialog] = useState<{ kb_id: string; kb_name: string } | null>(null);
  const [token, setToken] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const open = (kb_id: string, kb_name: string) => {
    setDialog({ kb_id, kb_name });
    setToken("");
    setFile(null);
    setError(null);
    setStatus("");
  };

  const close = () => {
    if (uploading) return;
    setDialog(null);
    setFile(null);
    setToken("");
    setError(null);
  };

  const handleUpload = async () => {
    if (!dialog || !file || !token) return;
    setUploading(true);
    setError(null);
    try {
      await uploadFileToKb(file, dialog.kb_id, token, setStatus);
      await refreshKbDocs(dialog.kb_id);
      setDialog(null);
      setToken("");
      setFile(null);
      setStatus("");
    } catch (e: any) {
      const msg = e.message ?? "Upload failed. Check your write token.";
      setError(
        msg.includes("409")
          ? `Duplicate: ${msg.split("Duplicate:").pop()?.trim() ?? msg}`
          : msg,
      );
    } finally {
      setUploading(false);
    }
  };

  return {
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
    open,
    close,
    handleUpload,
  };
}
