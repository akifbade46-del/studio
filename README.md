# Q'go Cargo Survey & Quote App

This project is a comprehensive tool for creating and managing moving surveys, calculating CBM, and generating quotes.

## Architecture

*   **Frontend**: A single `index.html` file built with vanilla HTML, CSS (Tailwind via CDN), and JavaScript.
*   **Backend**: A simple PHP-based REST API that saves and retrieves survey data as JSON files on the server.
*   **Data Storage**: The backend scripts store survey data as individual `.json` files in a `surveys/` directory.

## Deployment on Hostinger (or similar hosting)

1.  **Create a new site** on your Hostinger account.
2.  **Upload all project files** (`index.html`, `style.css`, `script.js`, `sw.js`, `manifest.webmanifest`) to the main directory of your site (e.g., `public_html`).
3.  **Create an `api/` directory** and upload `save-survey.php` and `load-surveys.php` into it.
4.  **Create a `surveys/` directory** in the root of your project.
5.  **Set Permissions**: Ensure that the `surveys/` directory has the correct permissions to allow the PHP scripts to write files. In most cases, permissions `755` or `775` should work. If you face issues, you might need to try `777`, but be aware of the security implications.
6.  **Test**: Open your website's URL. The app should now be live and fully functional, saving data directly to your hosting server.

## Project Details & Configuration

These values are placeholders. You can change them in the app's "Editor Mode".

*   **Company Name**: Q'go Cargo
*   **Company Address**: 123 Cargo Lane, Kuwait City, Kuwait
*   **Company Phone**: +965 1234 5678
*   **Company Email**: contact@qgocargo.com
