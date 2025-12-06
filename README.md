<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SBA Pro Master — Web

This repository contains the web frontend for the "SBA Pro Master" application —
a React + Vite project used to manage assessments, students, classes, and
generate printable report cards. It also includes tooling to generate a companion
WPF project.

**Key pieces**
- React + Vite web app (source files in project root and `components/`, `pages/`)
- `services/wpfProjectGenerator.ts` and `services/wpf_project_files/` — helpers and
  templates for producing a .NET WPF project of the report card UI

**Primary goals**
- Provide a fast local development experience for editing the web UI
- Produce a WPF project for integration into a desktop app

## Tech stack
- React 19, TypeScript
- Vite dev server (default port `5173`)
- Node.js / npm for scripts and build

## Prerequisites
- Node.js and npm (https://nodejs.org/)
- Python 3.x (optional — used for `start_server.py` helper)

## Quick start (recommended)
1. Install JavaScript dependencies:

```powershell
npm install
```

2. Start the dev server and open the app in your default browser using the helper script:

```powershell
python start_server.py
```

What `start_server.py` does:
- Kills any process currently listening on port `5173` (Windows `netstat` + `taskkill`)
- Starts `npm run dev` in the repository root
- Waits until the Vite dev server responds, then opens `http://localhost:5173/` in your browser

Note: If local dependencies (including `vite`) are not yet installed, the
helper will automatically run `npm install` before starting the dev server.
If automatic installation fails, run `npm install` manually and retry.

If you prefer to run the dev server directly:

```powershell
npm run dev
```

## Build for production

```powershell
npm run build
```

Then serve the `dist/` folder with any static server or use `vite preview`:

```powershell
npm run preview
```

## WPF project generator
The `services/wpfProjectGenerator.ts` script and the `wpf_project_files/` folder
contain templates and logic to produce a .NET WPF project from the web assets.
See the `services/wpfProjectGenerator.ts` file for usage details.

## Troubleshooting
- If `python start_server.py` prints "`npm` not found", ensure Node.js and npm
  are installed and that `npm` is available in your system `PATH`.
- On Windows, the script looks for `npm`, `npm.cmd`, or `npm.exe`; if these are
  missing you can still run `npm run dev` from PowerShell or Command Prompt.

## Contributing
- Follow the existing code style (TypeScript + React patterns)
- Run the dev server and make changes in `components/` and `pages/`

---
This README was updated to reflect the repository structure and how to run
and build the application locally.
