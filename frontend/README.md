# TRGB Drone System — Frontend

React 19 + TypeScript + Vite dashboard for the AI-Powered Fire Detection Drone System.

## Stack

- **React 19** with TypeScript
- **Vite** — dev server with HMR and `/api` + `/ws` proxy to the backend
- **Tailwind CSS** — utility-first styling
- **Zustand** — global UI state (feed pause, camera mode, WS connection)
- **TanStack Query** — server state and caching
- **Leaflet** — interactive drone map
- **Axios** — HTTP client

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Live feed, map, mission control, alerts, telemetry |
| `/missions` | Missions | Create and manage clearance missions |
| `/thermal-tool` | Thermal Tool | RGB → pseudo-thermal converter + Model 5 runner |

## Setup

```bash
npm install
npm run dev
```

Runs at `http://localhost:5173`. Requires the backend running at `http://localhost:8000`.

## Build

```bash
npm run build
```

Output goes to `dist/`.
