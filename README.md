# Q'go Cargo Job File System

This is a Next.js application for managing job files for Q'go Cargo.

## Deploying to Vercel

Deploying this application to Vercel is a straightforward process.

### Step 1: Push to GitHub

First, make sure your project is a GitHub repository and that you have pushed all the latest changes.

### Step 2: Import Project on Vercel

1.  Sign up or log in to your [Vercel account](https://vercel.com).
2.  From your Vercel Dashboard, click the **"Add New..."** button and select **"Project"**.
3.  The "Import Git Repository" screen will appear. If you haven't already, connect your GitHub account to Vercel.
4.  Find your project's repository in the list and click the **"Import"** button next to it.

### Step 3: Configure Project

1.  Vercel will automatically detect that you are using a Next.js project and will pre-fill the build settings. You do not need to change these.
2.  Expand the **"Environment Variables"** section. This is the most important step.
3.  You need to add all the Firebase secret keys that are used in the application. Copy the "Name" from the left column below and the corresponding "Value" from your Firebase project settings.

| Name                                    | Value                               |
| --------------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`          | Your Firebase API Key               |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`      | Your Firebase Auth Domain           |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`       | Your Firebase Project ID            |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`   | Your Firebase Storage Bucket        |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`| Your Firebase Messaging Sender ID   |
| `NEXT_PUBLIC_FIREBASE_APP_ID`           | Your Firebase App ID                |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`   | Your Firebase Measurement ID (optional) |

**Where to find your Firebase config values:**
* Go to your [Firebase Console](https://console.firebase.google.com/).
* Select your project.
* Click the gear icon (⚙️) next to "Project Overview" and select "Project settings".
* In the "General" tab, scroll down to the "Your apps" section.
* Click on your web app.
* In the "Firebase SDK snippet" section, select "Config".
* You will see all the keys and their values there.

### Step 4: Deploy

1.  After adding all the environment variables, click the **"Deploy"** button.
2.  Vercel will start building and deploying your application. You can watch the progress in the build logs.
3.  Once the deployment is complete, Vercel will give you a URL where your live application can be accessed. Congratulations!

---

This project also contains a separate, standalone Proof of Delivery (POD) system located in the `/public/pod` directory. Since it is in the `public` folder, Vercel will serve it as a static site. You can access it by going to your deployment URL and adding `/pod/` at the end (e.g., `https://your-deployment-url.vercel.app/pod/`).
