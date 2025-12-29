#!/bin/bash

# Script to set up GitHub Actions service account for CI/CD
# Usage: ./setup-github-actions.sh

set -e

PROJECT_ID="terraform-482108"
SA_NAME="github-actions-deployer"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "🚀 Setting up GitHub Actions service account for project: ${PROJECT_ID}"

# Check if service account already exists
if gcloud iam service-accounts describe ${SA_EMAIL} --project=${PROJECT_ID} &>/dev/null; then
    echo "⚠️  Service account ${SA_EMAIL} already exists. Skipping creation."
else
    echo "📝 Creating service account: ${SA_NAME}"
    gcloud iam service-accounts create ${SA_NAME} \
        --project=${PROJECT_ID} \
        --display-name="GitHub Actions Deployer" \
        --description="Service account for GitHub Actions CI/CD deployments"
fi

echo "🔐 Granting necessary permissions..."

# Grant Cloud Run Admin role
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/run.admin" \
    --condition=None \
    --quiet || echo "Role already granted"

# Grant Artifact Registry Writer role
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/artifactregistry.writer" \
    --condition=None \
    --quiet || echo "Role already granted"

# Grant Service Account User role
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/iam.serviceAccountUser" \
    --condition=None \
    --quiet || echo "Role already granted"

echo "🔑 Creating service account key..."

# Create key file
KEY_FILE="github-actions-key.json"
gcloud iam service-accounts keys create ${KEY_FILE} \
    --iam-account=${SA_EMAIL} \
    --project=${PROJECT_ID}

echo ""
echo "✅ Service account setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Copy the contents of ${KEY_FILE}"
echo "2. Go to your GitHub repository → Settings → Secrets and variables → Actions"
echo "3. Add a new secret named 'GCP_SA_KEY' with the contents of ${KEY_FILE}"
echo "4. Add these additional secrets:"
echo "   - GROQ_API_KEY"
echo "   - GOOGLE_CLIENT_ID"
echo "   - GOOGLE_CLIENT_SECRET"
echo "   - SESSION_SECRET"
echo ""
echo "⚠️  IMPORTANT: After adding the secret to GitHub, delete ${KEY_FILE} for security!"
echo ""
echo "To display the key, run: cat ${KEY_FILE}"

