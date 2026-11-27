# IELTS Band 6 vs Band 8: daily YouTube channel

Every day a GitHub Action picks the next episode file in `episodes/`, renders the video (code-drawn, no AI video tools), and uploads it to YouTube with title, description, chapters, tags, thumbnail and English captions.

## How it works
- `episodes/*.json`: the content of one video (task, Band 6 answer, Band 8 answer, flags, upgrades, "your turn", phrase bank, YouTube topic). Claude writes these in batches and pushes them.
- `engine/`: narration (Kokoro, voice `af_heart`), timeline, page renderer (HTML drawn frame by frame with headless Chrome), audio mix, uploader.
- `state/published.json`: which episodes are already live. The workflow adds to it after each upload.
- `.github/workflows/ielts-daily.yml`: runs daily at 12:30 UTC. You can also run it by hand (Actions tab, "Run workflow"), optionally as a dry run.

Run one locally: `cd engine && npm install && pip install kokoro-onnx soundfile numpy scipy`, put the Kokoro model files in `engine/models/`, then `python3 engine/run_episode.py episodes/ep001-letter-damaged-sofa.json`. Output lands in `out/ep001/` (`video.mp4`, `thumbnail.jpg`, `captions_en.srt`, `youtube.json`).

## One-time YouTube setup (about 20 minutes)
1. Go to console.cloud.google.com, create a project, and enable **YouTube Data API v3**.
2. APIs & Services, **OAuth consent screen**: External, add your own Google account as a **Test user**. Then **publish the app to Production** (otherwise the refresh token expires after 7 days).
3. **Credentials**, Create OAuth client ID, type **Desktop app**, download `client_secret.json`.
4. On your computer: `pip install google-auth-oauthlib` then `python tools/get_refresh_token.py client_secret.json`. Sign in as the channel owner. It prints three values.
5. In the GitHub repo: Settings, Secrets and variables, Actions, add secrets `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`.
6. Make sure the YouTube channel is **phone-verified** (needed for custom thumbnails).
7. Run the workflow once with **dry run** ticked to check the render, then once for real.

## Important: private until audited
Videos uploaded by an API project that has not passed Google's audit are locked to **private**. The workflow still uploads them (default `YT_PRIVACY=private`), so you can publish each one in YouTube Studio meanwhile. To get automatic public uploads, apply for the audit at support.google.com/youtube/contact/yt_api_form ("API Compliance Audit"). Once approved, set a repo variable `YT_PRIVACY` to `public`.

## Limits and costs
- Cost: free. GitHub Actions minutes (a render takes roughly 10 to 25 minutes) and the YouTube API quota (an upload uses about 2,000 of the 10,000 daily units) are both well inside free limits.
- When the queue runs out the workflow quietly does nothing. Keep at least a week of episodes queued.
- Sample answers are illustrative study material, not official IELTS scores, and the video says so.
- YouTube can limit channels whose videos look mass-produced and identical. Vary the tasks, topics and wording across episodes.

## Adding episodes
Copy an existing file in `episodes/`, name it `epNNN-slug.json` (the number sets the order), change the content, and keep each answer at or above the word minimum (150 for letters, 250 for essays).
