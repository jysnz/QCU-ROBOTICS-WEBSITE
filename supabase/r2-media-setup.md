# Cloudflare R2 media storage: setup

Where files go once this is on:

| Bucket | Public? | What goes in it |
|---|---|---|
| `otherphotos` | yes | every picture uploaded in the admin (members, media team, team players, coaches, competitions, achievements, sponsors), one folder per kind, plus each approved member's profile photo (`members/`) |
| `matches` | yes | competition match videos and thumbnails |
| `memberpictures` | **no** | the 5 photos people submit on `/member-reg` (and the full-resolution originals) |
| `tasks` | **no** | task attachments, in a folder per task |

The two private buckets are read through short-lived signed links, so they do not need public access. Turn it **off**
for `memberpictures` and `tasks` (bucket > Settings > Public access > R2.dev subdomain > Disable). Anyone with a public
link can open a file, and these hold personal photos and team files.

Nothing changes until you finish steps 1 to 4. Until `R2_MEDIA=1` is set, uploads keep going to Supabase Storage.

## 1. One API token for all four buckets
Cloudflare > R2 > Manage API tokens. Use (or widen) the token behind the `r2-photos` function so it has
**Object Read & Write** on `memberpictures`, `tasks`, `otherphotos` and `matches`. If you will copy the match videos
from an old bucket, include that bucket too. If you made a new token, store it in Supabase:

```
supabase secrets set R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... --project-ref szbtmeyoctkscwjcdrvg
```

`R2_ACCOUNT_ID` and `R2_BUCKET` (= memberpictures) are already set. The new function `r2-media` is deployed and reads
the same secrets. Optional names if a bucket is called something else: `R2_BUCKET_TASKS`, `R2_BUCKET_OTHERPHOTOS`,
`R2_BUCKET_MATCHES`.

## 2. CORS, so the browser can upload directly
On **`otherphotos`** and **`tasks`** (bucket > Settings > CORS policy), add:

```json
[
  {
    "AllowedOrigins": ["https://YOUR-SITE-DOMAIN", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

(`memberpictures` already has its own CORS for the original-photo uploads.)

## 3. Environment variables
On the server / hosting, and in `.env.local` for local work:

```
R2_MEDIA=1
NEXT_PUBLIC_R2_URL_OTHERPHOTOS=https://pub-a78794fdac404bbd9014077b946ce94b.r2.dev
NEXT_PUBLIC_R2_URL_MATCHES=https://pub-2d9519fa0e9d42ac910a000f5c210360.r2.dev
```

The two URLs are already in `.env.local`. Add `R2_MEDIA=1` last, then restart the server. `r2.dev` addresses are
rate-limited by Cloudflare. For the live site, connect a custom domain to `otherphotos` and `matches` (bucket > Settings >
Custom domains) and use that address instead, especially for the match videos.

## 4. Try it
Upload a photo anywhere in the admin, attach a file to a task, and submit a test registration at `/member-reg`.

## 5. Copy what is already stored
Dry run first (changes nothing), then for real. The R2 key is not in `.env.local`, so pass it on the command line:

```
R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... node scripts/migrate-to-r2.mjs
R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... node scripts/migrate-to-r2.mjs --run
```

Add `--matches-from-bucket=<old bucket> --matches-from-url=<its old public address>` to also move the match videos into
`matches` and rewrite `matches.video_url` / `matches.thumbnail`. `--only=photos,registrations,tasks,matches` runs
just some steps. The script never deletes: the Supabase copies stay until you remove them.

## 6. Match videos (upload, then convert in the background)
In the admin, **Add match** now takes a normal video file (MP4, MOV, WebM, MKV, up to 4 GB) instead of a link. The browser
uploads it straight to the `matches` bucket (`uploads/`) and the match is marked **processing**. Visitors see "This video is
still being processed" until a background worker has converted it to streaming pieces (`abr/master.m3u8`, 360p / 480p / 720p
playlists and 4-second `.ts` pieces, the same layout as the existing videos), set the match's video and thumbnail, and
deleted the original. A failed conversion is retried three times, then the match shows "Processing failed" in the admin.

The worker is `scripts/process-match-videos.mjs`. It needs ffmpeg and only the Supabase service key (files reach R2 through the
`r2-media` function). Run it in one of two ways:

* **Automatically, on GitHub** (recommended): `.github/workflows/process-match-videos.yml` checks every 10 minutes and converts
  whatever is waiting. Push the file, then add these under GitHub > Settings > Secrets and variables > Actions >
  New repository secret: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_R2_URL_MATCHES`. To run it
  right away instead of waiting: Actions > Process match videos > Run workflow.
* **On your own computer:** install ffmpeg (`winget install Gyan.FFmpeg`, then open a new terminal) and run
  `node scripts/process-match-videos.mjs` once, or add `--watch` to keep checking every minute.

Uploading needs `R2_MEDIA=1`, the CORS rule on `matches` (it must also allow `PUT` and the `Content-Type` header, see step 2),
and the `matches` bucket in the API token.

### Start the converter the moment a video is saved (no waiting for the timer)
GitHub's 10-minute timer can be late by tens of minutes. To avoid that, the website asks GitHub to run the workflow right after
you save a match with a new video (`/api/admin/match-video/process`). It needs one GitHub token:

1. GitHub > your profile photo > **Settings** > **Developer settings** > **Personal access tokens** > **Fine-grained tokens** >
   **Generate new token**.
2. **Repository access:** *Only select repositories* > `QCU-ROBOTICS-WEBSITE`.
3. **Permissions > Repository permissions > Actions:** **Read and write** (nothing else).
4. Choose an expiry (GitHub caps it at one year; set a reminder to renew it), generate, and copy the token.
5. Add it as `GITHUB_DISPATCH_TOKEN` in your hosting's environment variables (Vercel > Project > Settings > Environment Variables)
   and, for local testing, in `.env.local`. Never put it in a `NEXT_PUBLIC_` variable or commit it. Redeploy afterwards.

Without the token nothing breaks: the timer (or the Run workflow button) still converts the video, just later.
