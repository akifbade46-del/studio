# LocalPOD - Delivery Management System

This is a lightweight, modular web application for managing Proof of Delivery (POD) records. It's designed to be hosted on standard web hosting like Hostinger, using a PHP/MySQL backend for data persistence.

## Core Architecture

*   **Frontend**: A modular, multi-file structure using plain HTML, CSS, and modern JavaScript (ES Modules). The UI is clean, mobile-first, and does not rely on any heavy frameworks.
*   **Backend**: The system is designed to communicate with a PHP-based REST API for all data operations (users, PODs, media uploads, feedback).
*   **Data Storage**: The backend PHP scripts will connect to a MySQL database on the same hosting server to store all application data.
*   **Firebase Integration (Read-Only)**: Firebase is used exclusively to fetch and auto-fill job details based on a job number, reducing manual data entry. It does not write any data back to Firebase.

## Deployment on Hostinger (or similar LAMP stack hosting)

1.  **Upload Frontend Files**:
    *   Place `index.html`, `style.css`, `script.js`, and any other frontend `.js` modules into your main public directory (e.g., `public_html`).

2.  **Create API Directory**:
    *   Inside `public_html`, create a new directory named `api`.
    *   Inside `api`, you will need to create the PHP files that your `script.js` will call (e.g., `login.php`, `save_pod.php`, `get_pods.php`, etc.). These scripts will handle the logic for connecting to your database, hashing passwords, processing file uploads, and saving data.

3.  **Create Media Uploads Directory**:
    *   Inside `public_html`, create a directory named `uploads`.
    *   Ensure this `uploads` directory has write permissions (e.g., `755` or `775`) so that your PHP scripts can save uploaded delivery photos and signatures.

4.  **Set up Database**:
    *   Using your hosting control panel (like cPanel), go to "MySQL Databases" or a similar tool.
    *   Create a new database for the LocalPOD application.
    *   Create a new database user and assign it to the new database with full privileges. Note down the database name, username, and password.
    *   You will use these credentials in your PHP scripts to connect to the database.

5.  **Configure Firebase Credentials**:
    *   The read-only Firebase project configuration should be securely stored, preferably as environment variables on your server or within your PHP configuration, to be used when fetching job details.

6.  **Test**:
    *   Open your website's URL. The login screen should appear, and the application should now be live, communicating with your PHP backend to handle all data.
