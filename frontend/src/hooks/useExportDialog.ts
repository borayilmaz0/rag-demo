import { useState } from "react";
import { exportSessionToKb } from "../api";

export function useExportDialog(sessionId: string) {
  const [open, setOpen] = useState(false);
  const [exportName, setExportName] = useState("");
  const [exportDescription, setExportDescription] = useState("");
  const [exportResult, setExportResult] = useState<{
    kb_id: string;
    name: string;
    write_token: string;
    chunks_copied: number;
  } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  const handleOpen = () => {
    setExportName("");
    setExportDescription("");
    setExportResult(null);
    setExportError(null);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setExportName("");
    setExportDescription("");
    setExportResult(null);
    setExportError(null);
    setTokenCopied(false);
  };

  const handleExport = async () => {
    if (!exportName.trim()) return;
    setExporting(true);
    setExportError(null);
    try {
      const result = await exportSessionToKb(
        sessionId,
        exportName.trim(),
        exportDescription.trim() || null,
      );
      setExportResult(result);
    } catch (e: any) {
      setExportError(e.message ?? "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const handleCopyToken = () => {
    if (!exportResult) return;
    navigator.clipboard.writeText(exportResult.write_token);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  return {
    open,
    exportName,
    setExportName,
    exportDescription,
    setExportDescription,
    exportResult,
    exportError,
    exporting,
    tokenCopied,
    handleOpen,
    handleClose,
    handleExport,
    handleCopyToken,
  };
}
