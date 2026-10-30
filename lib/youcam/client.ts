import { append, budget, BudgetExceeded, UNIT_COST } from "../ledger";
import { secret } from "../env";
import {
  type FileApiResponse,
  type FitzpatrickResult,
  type SdConcern,
  type SkinAnalysisResult,
  SD_CONCERNS,
} from "./types";

const BASE = "https://yce-api-01.makeupar.com";
const REQUEST_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 120_000;

/**
 * Optional sink for verbatim response bodies, used by the smoke test to record
 * fixtures of what the API really returns rather than what the docs claim.
 */
let captureSink: ((event: { path: string; httpStatus: number; body: unknown }) => void) | null = null;

export function setCaptureSink(sink: typeof captureSink): void {
  captureSink = sink;
}

export class YouCamError extends Error {
  constructor(
    message: string,
    readonly code: string | null = null,
    readonly httpStatus: number | null = null,
  ) {
    super(message);
    this.name = "YouCamError";
  }
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret("YOUCAM_API_KEY")}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new YouCamError(`${method} ${path} returned non-JSON (HTTP ${res.status})`, null, res.status);
  }

  captureSink?.({ path, httpStatus: res.status, body: parsed });

  if (!res.ok) {
    const payload = parsed as { error?: string; error_code?: string };
    throw new YouCamError(
      payload.error ?? `${method} ${path} failed with HTTP ${res.status}`,
      payload.error_code ?? null,
      res.status,
    );
  }
  return parsed as T;
}

/**
 * Two steps: ask the File API for a pre-signed URL, then PUT the bytes to it with
 * exactly the headers it returned. The File API call alone uploads nothing, and
 * skipping the PUT makes the later task fail with 404 or 500.
 */
export async function uploadImage(
  bytes: Buffer,
  opts: { fileName: string; contentType?: string },
): Promise<string> {
  const contentType = opts.contentType ?? "image/jpeg";
  const init = await call<FileApiResponse>("POST", "/s2s/v2.0/file", {
    files: [{ content_type: contentType, file_name: opts.fileName, file_size: bytes.byteLength }],
  });

  const file = init.data?.files?.[0];
  const request = file?.requests?.[0];
  if (!file?.file_id || !request?.url) {
    throw new YouCamError("File API response did not contain an upload URL");
  }

  const put = await fetch(request.url, {
    method: request.method ?? "PUT",
    headers: request.headers,
    body: new Uint8Array(bytes),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!put.ok) {
    throw new YouCamError(`Upload PUT failed with HTTP ${put.status}`, null, put.status);
  }
  return file.file_id;
}

async function poll<T extends { task_status: string; error?: string | null; error_message?: string }>(
  path: string,
  onTick?: (status: string) => void,
): Promise<T> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    const res = await call<{ status: number; data: T }>("GET", path);
    const data = res.data;
    onTick?.(data.task_status);
    if (data.task_status === "success") return data;
    if (data.task_status === "error") {
      throw new YouCamError(data.error_message ?? "Task failed", data.error ?? null);
    }
    if (Date.now() > deadline) throw new YouCamError("Task timed out while running");
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

type BillableOpts = { scanId: string; imageHash: string };

/** Creates a task after checking the breaker. Returns the task id without polling. */
export async function createSkinAnalysis(
  fileId: string,
  opts: BillableOpts & { actions?: readonly SdConcern[] },
): Promise<string> {
  const actions = opts.actions ?? SD_CONCERNS;
  const state = await budget(UNIT_COST.skin_analysis_sd);
  if (!state.liveAllowed) {
    await append({
      scan_id: opts.scanId,
      endpoint: "task/skin-analysis",
      units: 0,
      status: "refused",
      image_hash: opts.imageHash,
      task_id: null,
      note: state.reason,
    });
    throw new BudgetExceeded(state);
  }

  const res = await call<{ status: number; data: { task_id: string } }>(
    "POST",
    "/s2s/v2.0/task/skin-analysis",
    { src_file_id: fileId, dst_actions: actions, format: "json" },
  );
  return res.data.task_id;
}

export async function pollSkinAnalysis(taskId: string, opts: BillableOpts): Promise<SkinAnalysisResult> {
  try {
    const data = await poll<SkinAnalysisResult>(`/s2s/v2.0/task/skin-analysis/${taskId}`);
    await append({
      scan_id: opts.scanId,
      endpoint: "task/skin-analysis",
      units: UNIT_COST.skin_analysis_sd,
      status: "success",
      image_hash: opts.imageHash,
      task_id: taskId,
    });
    return data;
  } catch (err) {
    await append({
      scan_id: opts.scanId,
      endpoint: "task/skin-analysis",
      units: 0,
      status: "error",
      image_hash: opts.imageHash,
      task_id: taskId,
      note: err instanceof YouCamError ? (err.code ?? err.message) : "request failed",
    });
    throw err;
  }
}

export async function createFitzpatrick(fileId: string, opts: BillableOpts): Promise<string> {
  const state = await budget(UNIT_COST.fitzpatrick);
  if (!state.liveAllowed) {
    await append({
      scan_id: opts.scanId,
      endpoint: "task/fitzpatrick-scale-analyzer",
      units: 0,
      status: "refused",
      image_hash: opts.imageHash,
      task_id: null,
      note: state.reason,
    });
    throw new BudgetExceeded(state);
  }

  const res = await call<{ status: number; data: { task_id: string } }>(
    "POST",
    "/s2s/v2.0/task/fitzpatrick-scale-analyzer",
    { src_file_id: fileId, version: "1.0", index: 0 },
  );
  return res.data.task_id;
}

export async function pollFitzpatrick(taskId: string, opts: BillableOpts): Promise<FitzpatrickResult> {
  try {
    const data = await poll<FitzpatrickResult>(`/s2s/v2.0/task/fitzpatrick-scale-analyzer/${taskId}`);
    await append({
      scan_id: opts.scanId,
      endpoint: "task/fitzpatrick-scale-analyzer",
      units: UNIT_COST.fitzpatrick,
      status: "success",
      image_hash: opts.imageHash,
      task_id: taskId,
    });
    return data;
  } catch (err) {
    await append({
      scan_id: opts.scanId,
      endpoint: "task/fitzpatrick-scale-analyzer",
      units: 0,
      status: "error",
      image_hash: opts.imageHash,
      task_id: taskId,
      note: err instanceof YouCamError ? (err.code ?? err.message) : "request failed",
    });
    throw err;
  }
}
