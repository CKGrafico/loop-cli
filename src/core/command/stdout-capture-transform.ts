import { Transform, type TransformCallback } from "node:stream";
import { MAX_CONTEXT_STDOUT_BYTES } from "../../shared/config/constants.js";

const KV_LINE_RE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

export interface CapturedContext {
  raw: string;
  kv: Record<string, string>;
}

export class StdoutCaptureTransform extends Transform {
  private captured: Buffer[] = [];
  private totalBytes = 0;
  private truncated = false;
  private readonly maxBytes: number;
  private partialLine = "";
  private kvPairs: Record<string, string> = {};
  private suppressJsonl = false;
  private jsonBuffer = "";

  constructor(maxBytes: number = MAX_CONTEXT_STDOUT_BYTES, suppressJsonl = false) {
    super({ decodeStrings: true });
    this.maxBytes = maxBytes;
    this.suppressJsonl = suppressJsonl;
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    if (this.suppressJsonl) {
      this.handleJsonlSuppression(chunk, callback);
    } else {
      this.handleNormal(chunk, callback);
    }
  }

  private handleNormal(chunk: Buffer, callback: TransformCallback): void {
    this.push(chunk);
    this.captureBytes(chunk);
    this.extractKvFromChunk(chunk);
    callback();
  }

  private handleJsonlSuppression(chunk: Buffer, callback: TransformCallback): void {
    this.captureBytes(chunk);
    const text = chunk.toString("utf-8");
    const combined = this.jsonBuffer + text;
    const lines = combined.split("\n");
    this.jsonBuffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let pushed = false;
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "object" && parsed !== null && "type" in parsed) {
          const t = parsed.type as string;
          if (t === "text" && parsed.part?.text) {
            this.push(parsed.part.text + "\n");
            pushed = true;
          } else if (t === "tool_use" && parsed.part?.state?.title) {
            this.push(`→ ${parsed.part.state.title} (${parsed.part.tool})\n`);
            pushed = true;
          } else if (t === "step_finish" && parsed.part?.reason === "stop") {
            const tok = parsed.part.tokens;
            if (tok) {
              this.push(`[tokens: ${tok.input} in / ${tok.output} out]\n`);
            }
            pushed = true;
          } else if (t === "error" && parsed.error?.data?.message) {
            this.push(`[error: ${parsed.error.data.message}]\n`);
            pushed = true;
          } else {
            pushed = true;
          }
        }
      } catch {
        // not JSON
      }
      if (!pushed) {
        this.push(line + "\n");
      }
    }
    callback();
  }

  private captureBytes(chunk: Buffer): void {
    if (this.truncated) return;
    const remaining = this.maxBytes - this.totalBytes;
    if (remaining <= 0) {
      this.truncated = true;
      return;
    }
    const chunkBytes = chunk.byteLength;
    if (chunkBytes <= remaining) {
      this.captured.push(Buffer.from(chunk));
      this.totalBytes += chunkBytes;
    } else {
      const slice = Buffer.from(chunk).subarray(0, remaining);
      this.captured.push(slice);
      this.totalBytes += slice.byteLength;
      this.truncated = true;
    }
    this.extractKvFromChunk(chunk);
  }

  private extractKvFromChunk(chunk: Buffer): void {
    const text = chunk.toString("utf-8");
    const combined = this.partialLine + text;
    const lines = combined.split("\n");
    this.partialLine = lines.pop() ?? "";

    for (const line of lines) {
      const match = line.trim().match(KV_LINE_RE);
      if (match) {
        this.kvPairs[match[1]] = match[2];
      }
    }
  }

  _flush(callback: TransformCallback): void {
    if (this.partialLine) {
      const match = this.partialLine.trim().match(KV_LINE_RE);
      if (match) {
        this.kvPairs[match[1]] = match[2];
      }
      this.partialLine = "";
    }
    if (this.jsonBuffer) {
      const trimmed = this.jsonBuffer.trim();
      if (trimmed) {
        try {
          const parsed = JSON.parse(trimmed);
          if (!(typeof parsed === "object" && parsed !== null && "type" in parsed)) {
            this.push(this.jsonBuffer + "\n");
          }
        } catch {
          this.push(this.jsonBuffer + "\n");
        }
      }
      this.jsonBuffer = "";
    }
    callback();
  }

  getCaptured(): string {
    if (this.captured.length === 0) return "";
    return Buffer.concat(this.captured, this.totalBytes).toString("utf-8");
  }

  getKvPairs(): Record<string, string> {
    return { ...this.kvPairs };
  }

  isTruncated(): boolean {
    return this.truncated;
  }
}
