import { type NextRequest } from "next/server";
import { json, requireAdmin } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Starts the background converter right after a match with a new video is saved, instead of waiting for GitHub's
   10-minute timer (which can be late by tens of minutes). It asks GitHub to run the "Process match videos" workflow.
   Server env (never NEXT_PUBLIC): GITHUB_DISPATCH_TOKEN, a fine-grained token for this repository with "Actions: Read and
   write". Optional: GITHUB_REPO (default jysnz/QCU-ROBOTICS-WEBSITE), GITHUB_WORKFLOW_FILE, GITHUB_DISPATCH_REF (default master).
   Without the token it does nothing and the timer picks the video up later, so it is safe to leave unset. */
const REPO = process.env.GITHUB_REPO || "jysnz/QCU-ROBOTICS-WEBSITE";
const WORKFLOW = process.env.GITHUB_WORKFLOW_FILE || "process-match-videos.yml";
const REF = process.env.GITHUB_DISPATCH_REF || "master";
const TOKEN = process.env.GITHUB_DISPATCH_TOKEN || "";

let last = 0; // per server instance: one start per few seconds is plenty (the workflow queues, it never runs twice at once)

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  if (!TOKEN) return json({ started: false, reason: "not-configured" });
  if (Date.now() - last < 5000) return json({ started: true, throttled: true });
  last = Date.now();
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", "User-Agent": "qcu-robotics-site" },
      body: JSON.stringify({ ref: REF }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 204) return json({ started: true });
    console.error("GitHub dispatch answered", res.status); // never log the token or the response body
    return json({ started: false, reason: `github-${res.status}` });
  } catch (e) {
    console.error("GitHub dispatch failed:", (e as Error).name);
    return json({ started: false, reason: "network" });
  }
}
