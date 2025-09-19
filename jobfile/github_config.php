
<?php
// IMPORTANT: FILL IN YOUR GITHUB DETAILS HERE
define('GITHUB_TOKEN', 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN'); // Replace with your GitHub Personal Access Token
define('GITHUB_USER', 'YOUR_GITHUB_USERNAME'); // Replace with your GitHub username
define('GITHUB_REPO', 'YOUR_GITHUB_REPOSITORY_NAME'); // Replace with your repository name
define('GITHUB_BRANCH', 'main'); // Or 'master', depending on your default branch
define('DATA_PATH', 'data/'); // The folder within your repo where job files will be stored

// --- INSTRUCTIONS ---
// 1. Create a GitHub Personal Access Token (PAT):
//    - Go to GitHub -> Settings -> Developer settings -> Personal access tokens -> Tokens (classic).
//    - Click "Generate new token".
//    - Give it a name (e.g., "Hostinger JobFile Access").
//    - Set an expiration date.
//    - Under "Select scopes", check the "repo" scope. This gives it full control of private repositories.
//    - Click "Generate token" and copy the token immediately.

// 2. Create a GitHub Repository:
//    - Create a new, private repository on GitHub (e.g., "qgo-job-files").
//    - Inside this repository, create a folder named "data".

// 3. Update the constants above with your details.
?>

    