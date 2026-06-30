# Architecture

## Goal
Transform the app into modular, maintainable JavaScript structure.

---

## Current Phase: Sprint 0
- Monolithic JS moved to /js/app.js
- CSS moved to /css/style.css
- No logic changes yet

---

## Planned Structure (Sprint 1+)

js/
- app.js (entry point)
- timer.js
- practice.js
- repertoire.js
- coach.js
- charts.js
- storage.js
- ui.js

---

## Core Principle
Separation of concerns:
- UI ≠ logic ≠ storage

---

## Data Model (future direction)

App = {
  practice,
  stats,
  timer,
  repertoire,
  coach
}