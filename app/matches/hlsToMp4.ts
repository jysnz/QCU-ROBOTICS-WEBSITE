import { FFmpeg } from '@ffmpeg/ffmpeg';

export type ConversionProgress =
  | { stage: 'downloading'; loaded: number; total: number }
  | { stage: 'converting' };

let ffmpegPromise: Promise<FFmpeg> | null = null;

const getFFmpeg = (): Promise<FFmpeg> => {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: '/ffmpeg/ffmpeg-core.js',
        wasmURL: '/ffmpeg/ffmpeg-core.wasm',
      });
      return ffmpeg;
    })().catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
  }
  return ffmpegPromise;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class FetchStatusError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const fetchWithRetry = async (url: string, attempts = 4): Promise<Response> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return res;
      lastError = new FetchStatusError(`Failed to fetch ${url}: ${res.status}`, res.status);
      // 404s are permanent (the object doesn't exist on R2) - retrying won't help.
      if (res.status === 404) break;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts - 1) await sleep(300 * 2 ** attempt);
  }

  throw lastError;
};

const fetchText = async (url: string): Promise<string> => (await fetchWithRetry(url)).text();

type Segment = { uri: string; duration: number };

const segmentExists = async (url: string): Promise<boolean> => {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
};

const countMissingSegments = async (segments: Segment[]): Promise<number> => {
  const results = await Promise.all(segments.map((segment) => segmentExists(segment.uri)));
  return results.filter((exists) => !exists).length;
};

const isMasterPlaylist = (text: string) => text.includes('#EXT-X-STREAM-INF');

const parseMasterPlaylist = (text: string, baseUrl: string): { bandwidth: number; uri: string }[] => {
  const lines = text.split('\n').map((line) => line.trim());
  const variants: { bandwidth: number; uri: string }[] = [];
  let pendingBandwidth = 0;

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const match = line.match(/BANDWIDTH=(\d+)/);
      pendingBandwidth = match ? parseInt(match[1], 10) : 0;
    } else if (!line.startsWith('#')) {
      variants.push({ bandwidth: pendingBandwidth, uri: new URL(line, baseUrl).toString() });
      pendingBandwidth = 0;
    }
  }

  return variants;
};

const parseMediaPlaylist = (text: string, baseUrl: string): Segment[] => {
  const lines = text.split('\n').map((line) => line.trim());
  const segments: Segment[] = [];
  let duration = 0;

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
      duration = parseFloat(line.slice('#EXTINF:'.length).split(',')[0]) || 0;
    } else if (!line.startsWith('#')) {
      segments.push({ uri: new URL(line, baseUrl).toString(), duration });
    }
  }

  return segments;
};

const segmentFilename = (index: number) => `seg${String(index).padStart(5, '0')}.ts`;

/**
 * Downloads an HLS stream (master or media playlist) and remuxes it into a single
 * MP4 file entirely client-side via ffmpeg.wasm. Uses `-c copy` (no re-encoding),
 * since the source is already H.264/AAC in an MPEG-TS container.
 */
export async function convertHlsToMp4(
  masterUrl: string,
  onProgress?: (progress: ConversionProgress) => void
): Promise<Blob> {
  const masterText = await fetchText(masterUrl);

  const renditionUrls = isMasterPlaylist(masterText)
    ? (() => {
        const variants = parseMasterPlaylist(masterText, masterUrl);
        if (!variants.length) throw new Error('No renditions found in HLS master playlist.');
        variants.sort((a, b) => b.bandwidth - a.bandwidth);
        return variants.map((variant) => variant.uri);
      })()
    : [masterUrl];

  // Different renditions of the same match are segmented independently, so a
  // partially-uploaded high-bitrate rendition can be missing segments that a
  // lower-bitrate rendition has (this is also why playback looks complete -
  // hls.js's ABR logic can switch away from the broken rendition, but a
  // static download can't). Probe each rendition and use the most complete one.
  let best: { uri: string; segments: Segment[]; missing: number } | null = null;

  for (const uri of renditionUrls) {
    const text = uri === masterUrl ? masterText : await fetchText(uri);
    const segments = parseMediaPlaylist(text, uri);
    if (!segments.length) continue;

    const missing = await countMissingSegments(segments);
    if (!best || missing < best.missing) best = { uri, segments, missing };
    if (missing === 0) break;
  }

  if (!best) throw new Error('No segments found in HLS playlist.');
  if (best.missing > 0) {
    console.warn(
      `[hlsToMp4] All renditions have missing segments; using the most complete one (${best.uri}, ${best.missing}/${best.segments.length} missing).`
    );
  }

  const segments = best.segments;

  const ffmpeg = await getFFmpeg();
  const writtenFiles: string[] = [];
  const downloadedSegments: Segment[] = [];

  try {
    for (let i = 0; i < segments.length; i++) {
      onProgress?.({ stage: 'downloading', loaded: i, total: segments.length });

      try {
        const res = await fetchWithRetry(segments[i].uri);
        const data = new Uint8Array(await res.arrayBuffer());
        const filename = segmentFilename(downloadedSegments.length);
        await ffmpeg.writeFile(filename, data);
        writtenFiles.push(filename);
        downloadedSegments.push(segments[i]);
      } catch (error) {
        if (error instanceof FetchStatusError && error.status === 404) {
          console.warn(`[hlsToMp4] Skipping missing segment ${i + 1}/${segments.length}: ${segments[i].uri}`);
          continue;
        }
        throw error;
      }
    }
    onProgress?.({ stage: 'downloading', loaded: segments.length, total: segments.length });

    if (!downloadedSegments.length) {
      throw new Error('All video segments are missing on storage; nothing to download.');
    }

    const targetDuration = Math.max(1, Math.ceil(Math.max(...downloadedSegments.map((s) => s.duration))));
    const localPlaylist = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      `#EXT-X-TARGETDURATION:${targetDuration}`,
      '#EXT-X-MEDIA-SEQUENCE:0',
      ...downloadedSegments.flatMap((segment, i) => [`#EXTINF:${segment.duration.toFixed(3)},`, segmentFilename(i)]),
      '#EXT-X-ENDLIST',
    ].join('\n');

    await ffmpeg.writeFile('playlist.m3u8', new TextEncoder().encode(localPlaylist));
    writtenFiles.push('playlist.m3u8');

    onProgress?.({ stage: 'converting' });
    await ffmpeg.exec(['-i', 'playlist.m3u8', '-c', 'copy', '-bsf:a', 'aac_adtstoasc', '-movflags', '+faststart', 'output.mp4']);

    const data = await ffmpeg.readFile('output.mp4');
    writtenFiles.push('output.mp4');

    return new Blob([data as unknown as BlobPart], { type: 'video/mp4' });
  } finally {
    await Promise.all(writtenFiles.map((file) => ffmpeg.deleteFile(file).catch(() => {})));
  }
}

export const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
