import { useState } from "react";
import { TopBar, BackButton, Input, Select, Button } from "../components/ui";
import type { Lecture, Language } from "../types";

export const languages: Language[] = ["Russian", "Kazakh", "English"];

export default function LectureInformation({
  lecture,
  onBack,
  onStart,
}: {
  lecture: Lecture;
  onBack: () => void;
  onStart: (lecture: Lecture) => void;
}) {
  const [draft, setDraft] = useState(lecture);

  const update = <Key extends keyof Lecture>(key: Key, value: Lecture[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="page-enter px-4 sm:px-6 md:px-8 py-2 md:py-4 max-w-4xl mx-auto">
      <TopBar subtitle={draft.sourceType === "upload" ? draft.sourceFile : "Recorded lecture"} title="Lecture Information" />
      <BackButton label="Back to Record" onClick={onBack} />
      <section className="rounded-card border border-line bg-card p-5">
        <div className="space-y-4">
          {[
            ["Lecture title", "title", "Graph Algorithms"],
            ["Subject", "subject", "Computer Science 101"],
            ["Professor", "professor", "Dr. Sarah Chen"],
          ].map(([label, key, placeholder]) => (
            <label className="block" key={key}>
              <span className="mb-2 block text-xs font-semibold text-copy-muted">{label}</span>
              <Input
                className="w-full rounded-xl border border-line bg-elevated px-4 py-3 text-sm text-white outline-none placeholder:text-copy-dim"
                onChange={(event) => update(key as "title" | "subject" | "professor", event.target.value)}
                placeholder={placeholder}
                value={draft[key as "title" | "subject" | "professor"]}
              />
            </label>
          ))}
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-copy-muted">Date</span>
            <Input
              className="w-full rounded-xl border border-line bg-elevated px-4 py-3 text-sm text-white outline-none"
              onChange={(event) => update("date", event.target.value)}
              type="date"
              value={draft.date}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-2 block text-xs font-semibold text-copy-muted">Source language</span>
              <Select
                className="w-full rounded-xl border border-line bg-elevated px-3 py-3 text-sm text-white"
                onChange={(event) => update("sourceLanguage", event.target.value as Language)}
                value={draft.sourceLanguage}
              >
                {languages.map((language) => <option key={language}>{language}</option>)}
              </Select>
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold text-copy-muted">Output language</span>
              <Select
                className="w-full rounded-xl border border-line bg-elevated px-3 py-3 text-sm text-white"
                onChange={(event) => update("outputLanguage", event.target.value as Language)}
                value={draft.outputLanguage}
              >
                {languages.map((language) => <option key={language}>{language}</option>)}
              </Select>
            </label>
          </div>
        </div>
      </section>
      <Button
        className="mt-5 w-full rounded-xl bg-gradient-to-r from-accent to-purple px-4 py-4 text-sm font-bold text-white shadow-glow disabled:opacity-40"
        disabled={!draft.title.trim()}
        onClick={() =>
          onStart({
            ...draft,
            subject: draft.subject.trim() || "Общий предмет",
            professor: draft.professor.trim() || "Преподаватель",
          })
        }
      >
        Start Processing
      </Button>
    </div>
  );
}
