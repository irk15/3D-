#!/usr/bin/env python3
"""One-time, on YOUR computer: python tools/get_refresh_token.py client_secret.json
Opens a browser, you sign in to the Google account that owns the YouTube channel, and it prints the refresh token."""
import sys
from google_auth_oauthlib.flow import InstalledAppFlow
flow = InstalledAppFlow.from_client_secrets_file(sys.argv[1], scopes=['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl'])
c = flow.run_local_server(port=0, access_type='offline', prompt='consent')
print('\nYT_CLIENT_ID     =', c.client_id); print('YT_CLIENT_SECRET =', c.client_secret); print('YT_REFRESH_TOKEN =', c.refresh_token)
