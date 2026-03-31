# Mini Tracker

A minimal-dependency web app to track mini inventory and painting status.

## Features

- Dashboard as the landing page with cross-page metrics for inventory, armies, scenarios, and painting
- Full-height left-side navigation rail with Mini Hub branding
- Data entry fields: game, faction, unit, number, type
- Painting status values: Unpainted, Primed, Painted, Based, Completed
- Search across game, faction, unit, and type
- Status filter with clear-filters control
- Sorting controls by game, faction, unit, number, type, and status
- Clickable sortable table headers with ascending/descending toggle
- Inventory table with status badges
- Inline edit and save/cancel per row
- Copy button to auto-fill the entry form from an existing row
- Advance status button for each row
- Delete button for each row
- Summary stats for unit entries, total minis, completed minis, and completion percentage
- Local persistence using browser localStorage (entries are retained across refresh/reopen)

## Run

Open `index.html` directly in your browser for the dashboard landing page, or `tracker.html` for the inventory view.

## Internet Access (Phone Anywhere)

Run the built-in app server so data is shared from one central store across devices:

1. `npm start`
2. Open `http://localhost:8080` on your computer.
3. Deploy this folder to a Node host (Render, Railway, Fly.io, etc.) and use the public HTTPS URL on your phone.

Notes:
- The server stores app data in `data/storage.json`.
- Set `MINI_HUB_TOKEN` in your hosting environment to require a token for API writes/reads.
- If you set a token, in the browser console run:
	`sessionStorage.setItem("mini-hub-token", "YOUR_TOKEN")`
	then refresh.

## Railway Setup Checklist

Create one Railway service from this repo/folder and set:

1. Start Command: `npm start`
2. Environment Variables:
	- `MINI_HUB_TOKEN` = choose a long random secret (recommended)
	- `MINI_HUB_DATA_DIR` = `/data`
3. Volume:
	- Add a persistent volume
	- Mount path: `/data`

Why this matters:
- Without a volume, app data can disappear on redeploy/restart because container filesystem is ephemeral.
- `MINI_HUB_DATA_DIR=/data` makes `storage.json` live on the mounted volume.
