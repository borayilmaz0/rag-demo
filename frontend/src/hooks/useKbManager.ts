import { useState, useCallback } from "react";
import { attachKb, detachKb, toggleKb, listKbs, getKbDocuments } from "../api";
import type { KnowledgeBase, Doc } from "../api";
import type { Session } from "../App";

export interface KbEntry {
  kb_id: string;
  name: string;
  enabled: boolean;
  docs: Doc[];
  expanded: boolean;
}

export function useKbManager(
  sessionId: string,
  initialSession: Session,
  setError: (msg: string | null) => void,
) {
  const [kbEntries, setKbEntries] = useState<KbEntry[]>(() =>
    initialSession.kb_ids.map((kb_id) => ({
      kb_id,
      name: initialSession.kb_names[kb_id] ?? kb_id,
      enabled: true,
      docs: [],
      expanded: false,
    })),
  );

  const [addKbDialog, setAddKbDialog] = useState(false);
  const [availableKbs, setAvailableKbs] = useState<KnowledgeBase[]>([]);
  const [addKbId, setAddKbId] = useState("");
  const [addKbLoading, setAddKbLoading] = useState(false);

  const refreshKbDocs = useCallback(async (kb_id: string) => {
    try {
      const res = await getKbDocuments(kb_id);
      setKbEntries((prev) =>
        prev.map((e) => (e.kb_id === kb_id ? { ...e, docs: res.documents } : e)),
      );
    } catch {}
  }, []);

  const handleToggleKb = async (kb_id: string, enabled: boolean) => {
    setKbEntries((prev) => prev.map((e) => (e.kb_id === kb_id ? { ...e, enabled } : e)));
    try {
      await toggleKb(sessionId, kb_id, enabled);
    } catch {}
  };

  const handleDetachKb = async (kb_id: string) => {
    try {
      await detachKb(sessionId, kb_id);
      setKbEntries((prev) => prev.filter((e) => e.kb_id !== kb_id));
    } catch (e: any) {
      setError(e.message ?? "Detach failed.");
    }
  };

  const handleToggleKbExpand = (kb_id: string) => {
    setKbEntries((prev) =>
      prev.map((e) => (e.kb_id === kb_id ? { ...e, expanded: !e.expanded } : e)),
    );
  };

  const handleOpenAddKb = async () => {
    try {
      const res = await listKbs();
      const attached = new Set(kbEntries.map((e) => e.kb_id));
      setAvailableKbs(res.knowledge_bases.filter((kb) => !attached.has(kb.kb_id)));
    } catch {}
    setAddKbId("");
    setAddKbDialog(true);
  };

  const handleAddKb = async () => {
    if (!addKbId) return;
    setAddKbLoading(true);
    try {
      await attachKb(sessionId, addKbId);
      const kb = availableKbs.find((k) => k.kb_id === addKbId)!;
      setKbEntries((prev) => [
        ...prev,
        { kb_id: addKbId, name: kb.name, enabled: true, docs: [], expanded: false },
      ]);
      await refreshKbDocs(addKbId);
      setAddKbDialog(false);
    } catch (e: any) {
      setError(e.message ?? "Failed to attach KB.");
    } finally {
      setAddKbLoading(false);
    }
  };

  return {
    kbEntries,
    addKbDialog,
    setAddKbDialog,
    availableKbs,
    addKbId,
    setAddKbId,
    addKbLoading,
    refreshKbDocs,
    handleToggleKb,
    handleDetachKb,
    handleToggleKbExpand,
    handleOpenAddKb,
    handleAddKb,
  };
}
