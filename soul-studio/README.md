# Soul Studio + Soul Bridge

Makes prompts and feeds them into Higgsfield Soul 2.0 automatically.

## Install the extension (once)
1. Download/clone this repo, find `soul-studio/extension/`.
2. Chrome > `chrome://extensions` > turn on Developer mode > Load unpacked > pick the `extension` folder.
3. If you open the studio from a local file, also tick "Allow access to file URLs" on the extension.

## Run
1. Open https://higgsfield.ai/ai/image?model=soul-v2, set model, aspect ratio and batch size the way you want (the bridge uses whatever is set on the page).
2. Open https://irk15.github.io/3D-/soul-studio/ in another tab. The dot in the header turns green when the bridge is connected.
3. On the Higgsfield tab click Start in the small Soul Bridge panel (bottom right).
4. In the studio click "Start endless". A new prompt is made every 30 seconds and sent.

The panel on the Higgsfield tab has its own "Gap" (minimum seconds between submits, default 30). Stops by itself if the page says you are out of credits.

If it cannot find the prompt box or Generate button the panel says so in its log line.
