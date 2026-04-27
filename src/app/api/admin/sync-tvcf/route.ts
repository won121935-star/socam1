import { NextResponse } from "next/server";
import { getLastSyncRun, type SyncProgress } from "@/lib/tvcf-crawler";
import { syncTvcfWithPlaywright } from "@/lib/tvcf-playwright-crawler";

// 모듈 레벨 상태 — 단일 Node.js 프로세스 안에서만 유효 (dev 서버용)
type RunningState = {
  status: "idle" | "running" | "done" | "error";
  startedAt: number | null;
  finishedAt: number | null;
  progress: SyncProgress | null;
  result: {
    runId: string;
    itemsFound: number;
    itemsSaved: number;
    errorCount: number;
    durationSec: number;
  } | null;
  error: string | null;
};

const globalState = globalThis as unknown as { _tvcfSync?: RunningState };
if (!globalState._tvcfSync) {
  globalState._tvcfSync = {
    status: "idle",
    startedAt: null,
    finishedAt: null,
    progress: null,
    result: null,
    error: null,
  };
}
const state = globalState._tvcfSync;

// GET — 현재 상태 + 마지막 sync 기록
export async function GET() {
  const lastRun = await getLastSyncRun();
  return NextResponse.json({
    state,
    lastRun: lastRun
      ? {
          id: lastRun.id,
          startedAt: lastRun.startedAt.toISOString(),
          finishedAt: lastRun.finishedAt?.toISOString() ?? null,
          itemsFound: lastRun.itemsFound,
          itemsSaved: lastRun.itemsSaved,
          errorCount: lastRun.errorCount,
        }
      : null,
  });
}

// POST — 동기화 시작 (이미 실행 중이면 409)
export async function POST() {
  if (state.status === "running") {
    return NextResponse.json(
      { error: "already_running", state },
      { status: 409 },
    );
  }

  state.status = "running";
  state.startedAt = Date.now();
  state.finishedAt = null;
  state.progress = {
    itemsFound: 0,
    itemsSaved: 0,
    errorCount: 0,
    currentStep: "시작 중…",
  };
  state.result = null;
  state.error = null;

  // fire-and-forget — Playwright 헤드리스 크롤러 사용 (로컬에서만 실행)
  void (async () => {
    try {
      const result = await syncTvcfWithPlaywright((p) => {
        state.progress = { ...p };
      });
      state.status = "done";
      state.result = result;
      state.finishedAt = Date.now();
    } catch (e) {
      state.status = "error";
      state.error = e instanceof Error ? e.message : "unknown_error";
      state.finishedAt = Date.now();
    }
  })();

  return NextResponse.json({ started: true, state });
}
