# Devpost draft copy

Paste this into the Build Beyond Hackathon submission form.

## Project name

Stillroom

## Tagline

A personal hush map for rooms you do not control.

## The overview

**The idea.** I have lost more evenings to "I'll start when it gets quieter" than I have to hard problem sets. Hostels, shared flats, and cafes do not publish a schedule for when the hallway goes still. Stillroom measures the room you actually have and shows the hours it goes quiet enough to work.

**How it works.** The app scores loudness from a microphone (Web Audio API) or from a generated hostel demo so it runs without mic permission. A focus session records that score, counts sustained interruptions, and writes samples into a seven-day by 24-hour heatmap. From the grid it ranks the quietest two-hour blocks. Data stays in the browser.

**Main features.** Live needle meter and loudness trace. Demo hostel mode. Focus sessions with average, quiet share, and interruption count. Hysteresis so a single slam is not three interruptions. Seven-day hush map. Quiet-window ranking. Local storage only.

**Technology stack.** TypeScript, Vite, vanilla DOM, Web Audio API, localStorage, Vitest.

**Intended audience.** Students and anyone who works in shared housing or noisy cafes and wants a factual answer to when the place is actually quiet.

## Built with

TypeScript, Vite, Web Audio API, HTML, CSS, Vitest

## Team

Suryansh Singh, sole builder (product, design, code, writeup). Devpost: suryanshg2050. GitHub: devSuryansh.
