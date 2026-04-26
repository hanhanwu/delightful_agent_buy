# Dev Guide

## Setup
### Commands
* `cd backend`
* `python -m venv .venv`
* `source .venv/Scripts/activate` 🚀
* `pip install -r requirements.txt`
* `cp .env.example .env`

* `cd backend`
* `uvicorn app.main:app --reload --port 8000` 🚀
* `cd web`
  * `netstat -ano | grep :3000` check whether local port is busy
  * `taskkill //PID <PID> //F` kill what occupies port 3000
* `npm run dev` 🚀, this will launch http://localhost:5173 within Cursor
* `npx cloudflared tunnel --url http://localhost:3000`  --> open its public site `https://faster-participant-compromise-utils.trycloudflare.com`

### Setup MoneyDevKit MCP in Cursor
* "Create App"
  * domain: https://faster-participant-compromise-utils.trycloudflare.com
  * Get `MDK_ACCESS_TOKEN` and `MDK_MNEMONIC`
* Go through this link: https://docs.moneydevkit.com/examples/tip-jar#cursor, cursor agent will setup for you

### Deploy to Vercel
* Vercel connect yo github repo
* Select web/ as root directory
* Add `MDK_ACCESS_TOKEN` and `MDK_MNEMONIC` as env variables
* `npx plugins add vercel/vercel-plugin`
* `cd web`
  * `npm install groq-sdk`