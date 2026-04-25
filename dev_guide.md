# Dev Guide

## Setup
### Commands
* `cd backend`
* `python -m venv .venv`
* `source .venv/Scripts/activate`
* `pip install -r requirements.txt`
* `cp .env.example .env`

* `cd backend`
* `uvicorn app.main:app --reload --port 8000` 🚀
* `cd web`
* `npm run dev` 🚀, this will launch http://localhost:5173 within Cursor

### Setup MoneyDevKit MCP in Cursor
* Go through this link: https://docs.moneydevkit.com/examples/tip-jar#cursor, cursor agent will setup for you