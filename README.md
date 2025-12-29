# Terraform Bot

An AI-powered Terraform configuration generator that helps you create infrastructure-as-code through natural language conversations.

## Features

- 🤖 **AI-Powered**: Uses Groq LLM to understand your infrastructure requirements
- 💬 **Conversational Interface**: Describe your needs in plain English
- 🔒 **Security Review**: Automatically reviews generated Terraform for security best practices
- ✅ **Approval Workflow**: Review and approve generated configurations before deployment
- 🚀 **Cloud Run Deployment**: Deploy directly to Google Cloud Run
- 🔄 **CI/CD Ready**: Automated deployment via GitHub Actions

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: FastAPI + Python
- **AI**: Groq LLM
- **Infrastructure**: Google Cloud Run, Artifact Registry
- **IaC**: Terraform

## Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Terraform-Bot
   ```

2. **Set up Backend**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env  # Create .env file with your secrets
   uvicorn main:app --reload
   ```

3. **Set up Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Access the app**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:8000

### Environment Variables

Create a `.env` file in the root directory:

```env
GROQ_API_KEY=your_groq_api_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
SESSION_SECRET=your_random_session_secret
```

## Deployment

### Deploy to Google Cloud Run

See [CICD_SETUP.md](./CICD_SETUP.md) for detailed CI/CD setup instructions.

**Quick deploy with Terraform:**
```bash
cd deploy
terraform init
terraform apply
```

### Automated CI/CD with GitHub Actions

1. **Set up Service Account** (one-time setup):
   ```bash
   ./setup-github-actions.sh
   ```

2. **Add GitHub Secrets**:
   - Go to your GitHub repo → Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `GCP_SA_KEY`: Service account key JSON (from setup script)
     - `GROQ_API_KEY`: Your Groq API key
     - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
     - `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret
     - `SESSION_SECRET`: Random secret string

3. **Push to main branch**:
   ```bash
   git push origin main
   ```

The workflow will automatically:
- Build Docker images
- Push to Artifact Registry
- Deploy to Cloud Run
- Make services publicly accessible

## Project Structure

```
.
├── frontend/          # React frontend application
├── deploy/            # Terraform infrastructure code
├── main.py           # FastAPI backend
├── Dockerfile.backend
├── Dockerfile.frontend
├── .github/
│   └── workflows/
│       └── deploy.yml  # GitHub Actions CI/CD
└── requirements.txt
```

## How It Works

1. **User describes infrastructure** → Frontend sends to backend
2. **AI processes request** → Groq LLM generates Terraform configuration
3. **Security review** → Automated security checks
4. **User approval** → Review and approve generated code
5. **Deployment** → Deploy to Cloud Run (optional)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License

## Support

For issues and questions, please open an issue on GitHub.

