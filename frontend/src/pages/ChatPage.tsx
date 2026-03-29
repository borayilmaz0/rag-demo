import { useState, useEffect } from "react";
import { Box } from "@mui/material";
import { deleteSession, switchMode, switchModel } from "../api";
import { useChat } from "../hooks/useChat";
import { useKbManager } from "../hooks/useKbManager";
import { useDocumentManager } from "../hooks/useDocumentManager";
import { useExportDialog } from "../hooks/useExportDialog";
import { useKbUploadDialog } from "../hooks/useKbUploadDialog";
import { useKbDeleteDialog } from "../hooks/useKbDeleteDialog";
import ChatSidebar from "../components/ChatSidebar";
import ChatArea from "../components/ChatArea";
import InputBar from "../components/InputBar";
import AddKbDialog from "../components/dialogs/AddKbDialog";
import KbUploadDialog from "../components/dialogs/KbUploadDialog";
import KbDeleteDialog from "../components/dialogs/KbDeleteDialog";
import ExportKbDialog from "../components/dialogs/ExportKbDialog";
import type { ModeConfig, ModelConfig } from "../api";
import type { Session } from "../App";

interface Props {
  session: Session;
  modes: ModeConfig[];
  models: ModelConfig[];
  onLeave: () => void;
}

export default function ChatPage({ session: initialSession, modes, models, onLeave }: Props) {
  const sessionId = initialSession.session_id;
  const [error, setError] = useState<string | null>(null);
  const [modeId, setModeId] = useState(initialSession.mode_id);
  const [modelId, setModelId] = useState(initialSession.model_id);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [topK, setTopK] = useState<number>(5);
  const [customTopK, setCustomTopK] = useState<string>("");

  const currentMode = modes.find((m) => m.id === modeId) ?? modes[0];
  const effectiveTopK = (() => { const p = parseInt(customTopK, 10); return !isNaN(p) && p > 0 ? p : topK; })();
  const willSearch = currentMode?.force_search || searchEnabled;

  useEffect(() => { if (currentMode?.force_search) setSearchEnabled(false); }, [modeId, currentMode]);

  const chat = useChat(sessionId, setError);
  const kbManager = useKbManager(sessionId, initialSession, setError);
  const docManager = useDocumentManager(sessionId, setError);
  const exportDialog = useExportDialog(sessionId);
  const kbUpload = useKbUploadDialog(kbManager.refreshKbDocs);
  const kbDelete = useKbDeleteDialog(kbManager.refreshKbDocs);

  // Scroll to bottom on new messages
  useEffect(() => {
    chat.bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.bottomRef, chat.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load initial docs on mount
  useEffect(() => {
    initialSession.kb_ids.forEach((kb_id) => kbManager.refreshKbDocs(kb_id));
    docManager.refreshSessionDocs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleModeChange = async (newModeId: string) => {
    setModeId(newModeId);
    try { await switchMode(sessionId, newModeId); } catch {}
  };

  const handleModelChange = async (newModelId: string) => {
    setModelId(newModelId);
    try { await switchModel(sessionId, newModelId); } catch {}
  };

  const handleLeave = async () => {
    try { await deleteSession(sessionId); } catch {}
    onLeave();
  };

  const handleDownload = () => {
    const modeName = modes.find((m) => m.id === modeId)?.label ?? modeId;
    const lines: string[] = [
      "# Chat Export", "",
      `- **Session:** ${initialSession.label}`,
      `- **Mode:** ${modeName}`,
      ...(kbManager.kbEntries.length > 0
        ? [`- **Knowledge Bases:** ${kbManager.kbEntries.map((e) => e.name).join(", ")}`]
        : []),
      `- **Exported:** ${new Date().toLocaleString()}`,
      "", "---", "",
    ];
    chat.messages.forEach((msg, idx) => {
      if (msg.role === "user") {
        lines.push("## 🧑 User", "", msg.content, "");
      } else {
        const label = models.find((m) => m.id === msg.modelId)?.label ?? msg.modelId ?? "unknown";
        lines.push("## 🤖 Assistant", "", `> **Model:** ${label}`);
        lines.push(msg.searchEnabled ? "> 🔍 Retrieved from documents" : "> 💬 Answered from model knowledge");
        lines.push("", msg.content, "");
        if (msg.sources?.length) {
          lines.push(`### Sources (${msg.sources.length})`, "");
          msg.sources.forEach((src, si) => {
            const page = src.page ? ` — p.${src.page}` : "";
            const section = src.section ? ` — ${src.section}` : "";
            lines.push(`**[${si + 1}] ${src.title ?? "Untitled"}${page}${section}** *(relevance: ${(src.score * 100).toFixed(0)}%)*`, "");
            src.text.split("\n").forEach((l) => lines.push(`> ${l}`));
            lines.push("");
          });
        }
      }
      if (idx < chat.messages.length - 1) lines.push("---", "");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${initialSession.label.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <ChatSidebar
        label={initialSession.label}
        modeId={modeId}
        modelId={modelId}
        modes={modes}
        models={models}
        onModeChange={handleModeChange}
        onModelChange={handleModelChange}
        onLeave={handleLeave}
        onDownload={handleDownload}
        messages={chat.messages}
        kbEntries={kbManager.kbEntries}
        onOpenAddKb={kbManager.handleOpenAddKb}
        onToggleKb={kbManager.handleToggleKb}
        onDetachKb={kbManager.handleDetachKb}
        onExpandKb={kbManager.handleToggleKbExpand}
        onOpenKbUpload={kbUpload.open}
        onOpenKbDelete={kbDelete.open}
        sessionDocs={docManager.sessionDocs}
        disabledDocIds={docManager.disabledDocIds}
        onToggleDoc={docManager.handleToggleDoc}
        onDeleteSessionDoc={docManager.handleDeleteSessionDoc}
        onExportOpen={exportDialog.handleOpen}
        uploading={docManager.uploading}
        uploadStatus={docManager.uploadStatus}
        dragOver={docManager.dragOver}
        setDragOver={docManager.setDragOver}
        fileInputRef={docManager.fileInputRef}
        onUpload={docManager.handleUpload}
      />

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <ChatArea
          messages={chat.messages}
          loading={chat.loading}
          error={error}
          willSearch={willSearch}
          models={models}
          expandedSources={chat.expandedSources}
          onToggleSources={chat.toggleSources}
          onDismissError={() => setError(null)}
          bottomRef={chat.bottomRef}
          kbCount={kbManager.kbEntries.length}
        />
        <InputBar
          input={chat.input}
          onInputChange={chat.setInput}
          loading={chat.loading}
          searchEnabled={searchEnabled}
          onSearchToggle={() => setSearchEnabled((v) => !v)}
          currentMode={currentMode}
          topK={topK}
          onTopKChange={setTopK}
          customTopK={customTopK}
          onCustomTopKChange={setCustomTopK}
          willSearch={willSearch}
          onSend={() => chat.handleSend(willSearch, effectiveTopK)}
        />
      </Box>

      <AddKbDialog
        open={kbManager.addKbDialog}
        onClose={() => kbManager.setAddKbDialog(false)}
        availableKbs={kbManager.availableKbs}
        selectedId={kbManager.addKbId}
        onSelectId={kbManager.setAddKbId}
        onConfirm={kbManager.handleAddKb}
        loading={kbManager.addKbLoading}
      />
      <KbUploadDialog {...kbUpload} />
      <KbDeleteDialog {...kbDelete} />
      <ExportKbDialog {...exportDialog} docCount={docManager.sessionDocs.length} />
    </Box>
  );
}
