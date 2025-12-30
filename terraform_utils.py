import subprocess
import os
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_command(command, cwd):
    """Runs a shell command and returns output or raises error."""
    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            shell=True,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        logger.error(f"Command failed: {e.cmd}\nStderr: {e.stderr}")
        raise Exception(f"Command failed: {e.stderr}")

def write_terraform_files(cwd, files):
    """Writes Terraform files from a dictionary to the specified directory."""
    os.makedirs(cwd, exist_ok=True)
    for filename, content in files.items():
        with open(os.path.join(cwd, filename), "w") as f:
            f.write(content)

def setup_gcs_backend(cwd, project_id, thread_id):
    """Creates a backend.tf file to store state in GCS."""
    bucket_name = f"terraform-bot-state-{project_id}"
    backend_config = f"""
terraform {{
  backend "gcs" {{
    bucket  = "{bucket_name}"
    prefix  = "terraform/state/{thread_id}"
  }}
}}
"""
    with open(os.path.join(cwd, "backend.tf"), "w") as f:
        f.write(backend_config)

def terraform_init(cwd):
    """Runs terraform init."""
    return run_command("terraform init -reconfigure", cwd)

def terraform_plan(cwd):
    """Runs terraform plan and returns the output."""
    return run_command("terraform plan -no-color -out=tfplan", cwd)

def terraform_apply(cwd):
    """Runs terraform apply."""
    return run_command("terraform apply -no-color -auto-approve tfplan", cwd)

def estimate_cost(cwd):
    """Runs infracost to estimate costs."""
    api_key = os.getenv("INFRACOST_API_KEY")
    if not api_key:
        return "Infracost API Key not found. Skipping cost estimation."
    
    try:
        # Ensure we have a plan first (though infracost can run on dir)
        # We'll run on the directory
        output = run_command("infracost breakdown --path . --format json", cwd)
        data = json.loads(output)
        
        total_monthly = data.get("totalMonthlyCost", "0.00")
        currency = data.get("currency", "USD")
        
        summary = f"Estimated Cost: {total_monthly} {currency}/month\n\n"
        
        # Add breakdown if available
        if "projects" in data and len(data["projects"]) > 0:
            breakdown = data["projects"][0].get("breakdown", {})
            if "resources" in breakdown:
                for res in breakdown["resources"]:
                    name = res.get("name", "Unknown")
                    cost = res.get("monthlyCost", "0")
                    if float(cost) > 0:
                        summary += f"- {name}: {cost} {currency}\n"
                        
        return summary
    except Exception as e:
        logger.error(f"Infracost failed: {e}")
        return f"Cost estimation failed: {str(e)}"

def upload_directory_to_gcs(cwd, project_id, thread_id):
    """Uploads the entire directory to a GCS bucket."""
    bucket_name = f"terraform-bot-archives-{project_id}"
    destination = f"gs://{bucket_name}/archives/{thread_id}/"
    
    try:
        # 1. Create bucket if not exists
        logger.info(f"Ensuring bucket {bucket_name} exists...")
        # Try creating, ignore error if it exists (or check first)
        # "gcloud storage buckets create" fails if exists. 
        # "gcloud storage ls" to check.
        try:
            run_command(f"gcloud storage buckets describe gs://{bucket_name}", cwd)
        except:
            logger.info(f"Bucket {bucket_name} not found. Creating...")
            run_command(f"gcloud storage buckets create gs://{bucket_name} --project={project_id} --location=us-central1", cwd)

        # 2. Upload files
        logger.info(f"Uploading files from {cwd} to {destination}...")
        # Exclude .terraform folder and other temp files if needed, but user asked for "terraform folder"
        # We'll upload everything for now, maybe exclude .git if it were a repo, but this is a temp dir.
        run_command(f"gcloud storage cp -r {cwd}/* {destination}", cwd)
        
        return f"Successfully uploaded files to {destination}"
    except Exception as e:
        logger.error(f"GCS Upload failed: {e}")
        return f"GCS Upload failed: {str(e)}"
