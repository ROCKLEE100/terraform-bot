# CI/CD Setup Guide

This guide will help you set up automated deployment to Google Cloud Run using GitHub Actions.

## Prerequisites

1. A GitHub account
2. A Google Cloud Project (terraform-482108)
3. A service account with the necessary permissions

## Step 1: Create a GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it (e.g., `terraform-bot`)
3. **Do NOT** initialize with README, .gitignore, or license (we already have these)

## Step 2: Create a Service Account in GCP

Run these commands to create a service account with the necessary permissions:

```bash
# Set your project
export PROJECT_ID=terraform-482108
export SA_NAME=github-actions-deployer
export SA_EMAIL=${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com

# Create service account
gcloud iam service-accounts create ${SA_NAME} \
    --project=${PROJECT_ID} \
    --display-name="GitHub Actions Deployer"

# Grant necessary roles
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/iam.serviceAccountUser"

# Create and download key
gcloud iam service-accounts keys create key.json \
    --iam-account=${SA_EMAIL} \
    --project=${PROJECT_ID}

# Display the key (you'll need to copy this)
cat key.json
```

## Step 3: Add GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add the following secrets:

   - **GCP_SA_KEY**: Paste the entire contents of `key.json` (the service account key you just created)
   - **GROQ_API_KEY**: Your Groq API key
   - **GOOGLE_CLIENT_ID**: Your Google OAuth Client ID
   - **GOOGLE_CLIENT_SECRET**: Your Google OAuth Client Secret
   - **SESSION_SECRET**: A random secret string for session management (e.g., generate with `openssl rand -hex 32`)

## Step 4: Update OAuth Redirect URIs

Since your backend will be deployed to Cloud Run, you need to update your Google OAuth credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID
3. Add these Authorized redirect URIs:
   - `https://terraform-bot-backend-904593353942.us-central1.run.app/auth/callback`
   - (Replace with your actual backend URL after first deployment)

## Step 5: Push to GitHub

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Terraform Bot with CI/CD"

# Add your GitHub repository as remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to main branch
git branch -M main
git push -u origin main
```

## Step 6: Verify Deployment

1. Go to your GitHub repository
2. Click on the **Actions** tab
3. You should see the workflow running
4. Once complete, the workflow will output the service URLs

## How It Works

- **On every push to `main` branch**: The workflow automatically:
  1. Builds Docker images for backend and frontend
  2. Pushes images to Artifact Registry
  3. Deploys both services to Cloud Run
  4. Makes services publicly accessible

- **Manual trigger**: You can also manually trigger the workflow from the Actions tab

## Troubleshooting

### Workflow fails with permission errors
- Verify the service account has all required roles
- Check that `GCP_SA_KEY` secret contains valid JSON

### Frontend can't connect to backend
- Check that `VITE_API_URL` is set correctly in the build
- Verify backend URL is accessible
- Check browser console for CORS errors

### OAuth redirect fails
- Ensure redirect URI in Google Cloud Console matches your backend URL
- Check that backend URL is correct in the frontend build

## Cleanup

To remove the service account key file after adding it to GitHub Secrets:

```bash
rm key.json
```

**Important**: Never commit `key.json` to git! It's already in `.gitignore`.

