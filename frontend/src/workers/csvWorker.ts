// Simple CSV parse worker using PapaParse
// Receives: { file: File, options?: Papa.ParseConfig }
// Sends progress and final result back to main thread

import Papa, { type ParseConfig, type ParseResult } from "papaparse";

// Types for messages
interface ParseRequest {
  type: "parse";
  file: File;
  options?: ParseConfig;
}

interface ProgressMessage {
  type: "progress";
  rows: number;
}

interface ResultMessage {
  type: "result";
  rows: any[];
}

self.onmessage = (event: MessageEvent<ParseRequest>) => {
  const { data } = event;
  if (!data || data.type !== "parse" || !data.file) {
    return;
  }

  const rows: any[] = [];
  Papa.parse<any>(data.file as any, {
    header: false,
    skipEmptyLines: true,
    chunkSize: 1024 * 64,
    ...data.options,
    chunk: (result: ParseResult<any>) => {
      rows.push(...result.data);
      (self as any).postMessage({ type: "progress", rows: rows.length } as ProgressMessage);
    },
    complete: () => {
      (self as any).postMessage({ type: "result", rows } as ResultMessage);
    },
    error: (err: any) => {
      (self as any).postMessage({ type: "error", message: err?.message || "Unknown parse error" });
    },
  });
};
