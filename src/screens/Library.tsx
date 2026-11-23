import { useState, useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import { TopBar, Button, Icon, Input, Audio } from "../components/ui";
import {
  type RecordingRow,
  listRecordings,
  deleteRecording,
  updateRecording,
  getSignedAudioUrl,
} from "../lib/supabase";
import { hasJsonContent } from "../utils/helpers";

export default function Library({
  onOpen,
  onRecordNew,
  onUploadFile,
}: {
  onOpen: (row: RecordingRow) => Promise<void>;
  onRecordNew: () => void;
  onUploadFile?: (file: File) => void;
}) {
  const { t } = useI18n();
  const libraryFileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<RecordingRow[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      setError("");
      setRows(await listRecordings());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить библиотеку.");
      setRows([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const open = async (row: RecordingRow) => {
    setBusyId(row.id);
    try {
      await onOpen(row);
    } finally {
      setBusyId(null);
    }
  };

  const saveTitle = async (row: RecordingRow) => {
    const clean = editingTitle.trim() || "Лекция без названия";
    setEditingId(null);
    setRows((current) => current?.map((item) => (item.id === row.id ? { ...item, title: clean } : item)) ?? null);
    try {
      await updateRecording(row.id, { title: clean });
    } catch {}
  };

  const toggleAudio = async (row: RecordingRow) => {
    if (!row.audio_path) return;
    if (playingId === row.id) {
      setPlayingId(null);
      return;
    }
    if (!audioUrls[row.id]) {
      try {
        const url = await getSignedAudioUrl(row.audio_path);
        setAudioUrls((prev) => ({ ...prev, [row.id]: url }));
      } catch {
        setError("Не удалось получить ссылку на аудиозапись.");
        return;
      }
    }
    setPlayingId(row.id);
  };

  const remove = async (row: RecordingRow) => {
    if (!window.confirm(`Удалить «${row.title ?? "лекцию"}»? Это действие нельзя отменить.`)) return;
    setBusyId(row.id);
    try {
      await deleteRecording(row);
      setRows((current) => current?.filter((item) => item.id !== row.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить запись.");
    } finally {
      setBusyId(null);
    }
  };

  const length = (seconds: number | null) =>
    seconds == null ? "" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  const filteredRows = (rows ?? []).filter((r) => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return true;
    return `${r.title ?? ""} ${r.transcript ?? ""}`.toLowerCase().includes(q);
  });

  return (
    <div className="page-enter px-4 sm:px-6 md:px-8 py-2 md:py-6">
      <TopBar
        subtitle={`${t.statLectures}: ${rows?.length ?? 0}`}
        title={t.libraryTitle}
        action={
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={libraryFileInputRef}
              accept=".pdf,application/pdf,text/*,.txt,.md,audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && onUploadFile) {
                  onUploadFile(f);
                  e.target.value = "";
                }
              }}
            />
            <Button
              className="rounded-xl border border-line bg-card px-3 py-2 text-xs font-bold text-copy hover:text-white hover:border-purple transition flex items-center gap-1.5 shadow-sm"
              onClick={() => libraryFileInputRef.current?.click()}
              title={t.uploadFile}
            >
              <Icon name="document" className="size-3.5 text-purple-light" />
              <span>{t.uploadFile}</span>
            </Button>
            <Button
              className="rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white shadow-glow"
              onClick={onRecordNew}
            >
              + {t.navRecord}
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
        <Icon name="search" className="size-4 text-copy-muted" />
        <Input
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-copy-dim"
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder={t.searchLibrary}
          value={filterQuery}
        />
        {filterQuery && (
          <Button className="text-xs font-bold text-copy-muted" onClick={() => setFilterQuery("")}>
            ✕
          </Button>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red/30 bg-red/10 p-3 text-xs leading-5 text-red">{error}</p>
      )}
      {rows === null && <p className="text-sm text-copy-muted">{t.loading}</p>}
      {rows?.length === 0 && !error && (
        <div className="rounded-card border border-line bg-card p-8 text-center max-w-lg mx-auto my-8">
          <p className="text-sm leading-6 text-copy-muted">
            {t.noRecordingsYet}
          </p>
          <Button
            className="mt-4 rounded-xl bg-gradient-to-r from-accent to-purple px-5 py-3 text-xs font-bold text-white shadow-glow"
            onClick={onRecordNew}
          >
            {t.recordLecture}
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRows.map((row) => {
          const hasSum = hasJsonContent(row.summary);
          const hasStu = hasJsonContent(row.study);
          return (
            <section className="rounded-card border border-line bg-card p-4" key={row.id}>
              <div className="flex items-start justify-between gap-2">
                {editingId === row.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      autoFocus
                      className="min-w-0 flex-1 rounded-xl border border-accent bg-elevated px-3 py-1.5 text-sm font-bold text-white outline-none"
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void saveTitle(row)}
                      value={editingTitle}
                    />
                    <Button
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white"
                      onClick={() => void saveTitle(row)}
                    >
                      ОК
                    </Button>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-white">{row.title ?? "Без названия"}</div>
                    <div className="mt-1 text-xs text-copy-muted">
                      {row.created_at ? new Date(row.created_at).toLocaleString("ru-RU") : ""}
                      {row.duration != null ? ` · ${length(row.duration)}` : ""}
                    </div>
                  </div>
                )}
                {editingId !== row.id && (
                  <Button
                    className="rounded-lg border border-line bg-elevated px-2.5 py-1 text-mini font-semibold text-copy-muted hover:text-white"
                    onClick={() => {
                      setEditingId(row.id);
                      setEditingTitle(row.title ?? "");
                    }}
                    title="Переименовать"
                  >
                    Изм.
                  </Button>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {row.transcript && (
                  <span className="rounded-full bg-elevated px-2.5 py-0.5 text-mini font-semibold text-copy-muted">
                    Транскрипт
                  </span>
                )}
                {hasSum && (
                  <span className="rounded-full bg-accent-muted px-2.5 py-0.5 text-mini font-bold text-accent-bright">
                    ИИ-конспект
                  </span>
                )}
                {hasStu && (
                  <span className="rounded-full bg-purple/15 px-2.5 py-0.5 text-mini font-bold text-purple-light">
                    Квиз и карточки
                  </span>
                )}
                {row.audio_path && (
                  <Button
                    className="rounded-full bg-green/10 px-2.5 py-0.5 text-mini font-bold text-green"
                    onClick={() => void toggleAudio(row)}
                  >
                    {playingId === row.id ? "Скрыть плеер" : "▶ Слушать аудио"}
                  </Button>
                )}
              </div>

              {playingId === row.id && audioUrls[row.id] && (
                <Audio className="mt-3 w-full" controls src={audioUrls[row.id]} />
              )}

              <div className="mt-3 grid grid-cols-2 gap-3">
                <Button
                  className="rounded-xl bg-accent py-3 text-xs font-bold text-white disabled:opacity-50"
                  disabled={busyId === row.id}
                  onClick={() => open(row)}
                >
                  Открыть конспект
                </Button>
                <Button
                  className="rounded-xl border border-red/25 bg-red/10 py-3 text-xs font-bold text-red disabled:opacity-50"
                  disabled={busyId === row.id}
                  onClick={() => remove(row)}
                >
                  Удалить
                </Button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
