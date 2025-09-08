# Q'go Cargo Survey & Quote App

This project is a comprehensive tool for creating and managing moving surveys, calculating CBM, and generating quotes.

## Architecture

*   **Frontend**: A single `index.html` file built with vanilla HTML, CSS, and JavaScript, using TailwindCSS via CDN. It is designed to be deployed as a static site on GitHub Pages.
*   **Backend**: A Cloudflare Worker that acts as a REST API.
*   **Data Storage**: The backend worker saves and retrieves survey data as JSON files directly in a GitHub repository.

## Project Details & Configuration

These values are placeholders. You can change them in the app's "Editor Mode".

*   **GitHub Owner**: `akifbade46-del`
*   **GitHub Repo**: `studio`
*   **Company Name**: Q'go Cargo
*   **Company Address**: 123 Cargo Lane, Kuwait City, Kuwait
*   **Company Phone**: +965 1234 5678
*   **Company Email**: contact@qgocargo.com

## Frontend Deployment (GitHub Pages)

1.  Push `index.html` to your GitHub repository.
2.  Enable GitHub Pages in your repository settings to serve from the `main` branch and `/` (root) directory.
3.  Your live app will be available at: `https://akifbade46-del.github.io/studio/`.

## Backend Deployment (Cloudflare Worker)

1.  Navigate to the `worker/` directory.
2.  Run `npm install` to install dependencies.
3.  Rename `.dev.vars.example` to `.dev.vars` and fill in the required secrets, especially your GitHub Personal Access Token (`GH_PAT`).
4.  Run `npx wrangler deploy` to publish your worker.
5.  After deployment, copy the worker URL and paste it into the "Worker Base URL" field in the frontend app's Editor settings.
