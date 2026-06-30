"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";

interface FileDropProps {
  id: string;
  name: string;
  label: ReactNode;
  /** Testo principale nel riquadro (il chiamante lo deriva dal proprio stato). */
  boxText: string;
  /** Riga piccola sotto al testo principale (es. "DOC, DOCX"). */
  boxHint: ReactNode;
  accept?: string;
  required?: boolean;
  multiple?: boolean;
  /** Invocato sia al click (file-picker) sia al drop, coi file selezionati. */
  onFiles: (files: File[]) => void;
  /** Contenuto extra sotto al riquadro (es. elenco visure). */
  children?: ReactNode;
}

// Riquadro di caricamento con drag-and-drop REALE + click per sfogliare. L'input
// nascosto resta la fonte di verità per il submit via FormData: sul drop i file
// vengono riversati nell'input tramite DataTransfer.
export function FileDrop({
  id,
  name,
  label,
  boxText,
  boxHint,
  accept,
  required,
  multiple,
  onFiles,
  children,
}: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    const dropped = Array.from(e.dataTransfer.files ?? []);
    if (!dropped.length) return;
    const files = multiple ? dropped : dropped.slice(0, 1);
    // Riversa i file trascinati nell'input nascosto: così la form li invia normalmente.
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);
    if (inputRef.current) inputRef.current.files = dt.files;
    onFiles(files);
  }

  return (
    <div className="flex flex-col">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center px-4 py-6 cursor-pointer transition-colors ${
          dragActive
            ? "border-[var(--brand-blue)] bg-blue-50"
            : "border-[var(--brand-gray)] bg-gray-50 hover:border-[var(--brand-blue)]"
        }`}
      >
        <span className="text-sm text-[var(--brand-blue)] font-medium">{boxText}</span>
        <span className="text-xs text-gray-500 mt-1">{boxHint}</span>
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        required={required}
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={(e) => onFiles(Array.from(e.target.files ?? []))}
      />
      {children}
    </div>
  );
}
