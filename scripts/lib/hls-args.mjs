/* The ffmpeg command that turns one video into a streaming version: a master playlist, one playlist per quality and
   4-second .ts pieces, the same layout the existing match videos use (abr/master.m3u8, stream_0.m3u8, stream_00.ts, ...).
   Shared by the worker (native ffmpeg) and its test (ffmpeg.wasm). Run it with the output folder as the working folder. */
export const LADDER = [
  { h: 360, v: "800k" },
  { h: 480, v: "1400k" },
  { h: 720, v: "2800k" },
];

/** Qualities to make for a source that is `height` pixels tall: never bigger than the source (at least one). */
export function pickLadder(height) {
  const fit = LADDER.filter((l) => l.h <= height + 8);
  return fit.length ? fit : [{ h: Math.max(2, Math.round(height / 2) * 2), v: "800k" }];
}

const num = (s) => Number.parseInt(s, 10);

export function buildHlsArgs({ input, ladder, hasAudio }) {
  const n = ladder.length;
  const graph = `[0:v]split=${n}${ladder.map((_, i) => `[s${i}]`).join("")};` + ladder.map((l, i) => `[s${i}]scale=-2:${l.h}[o${i}]`).join(";");
  const args = ["-y", "-i", input, "-filter_complex", graph];
  ladder.forEach((l, i) => {
    const kbps = num(l.v);
    args.push("-map", `[o${i}]`, `-c:v:${i}`, "libx264", `-b:v:${i}`, l.v, `-maxrate:v:${i}`, `${Math.round(kbps * 1.07)}k`, `-bufsize:v:${i}`, `${kbps * 2}k`);
  });
  if (hasAudio) ladder.forEach((_, i) => args.push("-map", "a:0", `-c:a:${i}`, "aac", `-b:a:${i}`, "128k", "-ac", "2"));
  args.push(
    "-preset", "veryfast", "-profile:v", "high", "-pix_fmt", "yuv420p", "-sc_threshold", "0",
    "-force_key_frames", "expr:gte(t,n_forced*4)",
    "-f", "hls", "-hls_time", "4", "-hls_playlist_type", "vod", "-hls_flags", "independent_segments", "-hls_segment_type", "mpegts",
    "-hls_segment_filename", "stream_%v%d.ts", "-master_pl_name", "master.m3u8",
    "-var_stream_map", ladder.map((_, i) => (hasAudio ? `v:${i},a:${i}` : `v:${i}`)).join(" "),
    "stream_%v.m3u8",
  );
  return args;
}
