import subprocess
import sys
import time
import json
from datetime import datetime

def run_command(cmd, error_msg=None):
    """Run a shell command and return success status."""
    result = subprocess.run(cmd, shell=True)
    if result.returncode != 0 and error_msg:
        print(f"ERROR: {error_msg}")
        return False
    return True

def get_workflow_status(username, repo_name):
    """
    Check the latest GitHub Actions workflow run status.
    Returns: (status, conclusion, run_id, html_url, created_at) or None if failed
    """
    try:
        # Use GitHub CLI if available, otherwise use curl
        api_url = f"https://api.github.com/repos/{username}/{repo_name}/actions/runs?per_page=1"
        
        # Try using curl to get the latest workflow run
        result = subprocess.run(
            f'curl -s -H "Accept: application/vnd.github.v3+json" {api_url}',
            shell=True,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            return None
            
        data = json.loads(result.stdout)
        
        if not data.get('workflow_runs'):
            return None
            
        latest_run = data['workflow_runs'][0]
        
        return (
            latest_run.get('status'),           # 'queued', 'in_progress', 'completed'
            latest_run.get('conclusion'),       # 'success', 'failure', 'cancelled', etc.
            latest_run.get('id'),
            latest_run.get('html_url'),
            latest_run.get('created_at')
        )
    except Exception as e:
        print(f"Error checking workflow status: {e}")
        return None

def monitor_deployment(username, repo_name, max_wait_minutes=10):
    """
    Monitor GitHub Actions deployment and report status.
    Returns True if deployment succeeded, False otherwise.
    """
    print("\n" + "="*60)
    print("MONITORING GITHUB ACTIONS DEPLOYMENT")
    print("="*60)
    
    # Wait a moment for GitHub to register the push
    print("Waiting for GitHub Actions to start...")
    time.sleep(5)
    
    start_time = time.time()
    max_wait_seconds = max_wait_minutes * 60
    last_status = None
    run_url = None
    
    while True:
        elapsed = time.time() - start_time
        
        if elapsed > max_wait_seconds:
            print(f"\nTimeout: Deployment monitoring exceeded {max_wait_minutes} minutes.")
            print(f"Visit https://github.com/{username}/{repo_name}/actions to check manually.")
            return False
        
        # Check workflow status
        status_data = get_workflow_status(username, repo_name)
        
        if not status_data:
            print(".", end="", flush=True)
            time.sleep(5)
            continue
        
        status, conclusion, run_id, html_url, created_at = status_data
        
        # Store the run URL for later
        if html_url and not run_url:
            run_url = html_url
            print(f"\nWorkflow URL: {html_url}")
        
        # Print status updates only when status changes
        if status != last_status:
            if status == 'queued':
                print("\n📦 Status: Queued - Waiting for runner...")
            elif status == 'in_progress':
                print("\n⚙️  Status: In Progress - Building and deploying...")
            elif status == 'completed':
                print(f"\n✅ Status: Completed")
                
                # Calculate duration
                if created_at:
                    try:
                        start_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                        end_dt = datetime.now(start_dt.tzinfo)
                        duration = (end_dt - start_dt).total_seconds()
                        duration_str = f"{int(duration // 60)}m {int(duration % 60)}s"
                    except:
                        duration_str = "unknown"
                else:
                    duration_str = "unknown"
                
                # Check conclusion
                if conclusion == 'success':
                    print("\n" + "="*60)
                    print("🎉 DEPLOYMENT SUCCESSFUL!")
                    print("="*60)
                    print(f"⏱️  Time taken: {duration_str}")
                    print(f"🔗 Workflow: {run_url}")
                    print(f"🌐 Site: https://{username}.github.io/{repo_name}/")
                    print("="*60)
                    return True
                elif conclusion == 'failure':
                    print("\n" + "="*60)
                    print("❌ DEPLOYMENT FAILED")
                    print("="*60)
                    print(f"⏱️  Time taken: {duration_str}")
                    print(f"🔗 Check logs: {run_url}")
                    print("="*60)
                    return False
                elif conclusion == 'cancelled':
                    print("\n" + "="*60)
                    print("⚠️  DEPLOYMENT CANCELLED")
                    print("="*60)
                    print(f"🔗 Workflow: {run_url}")
                    print("="*60)
                    return False
                else:
                    print(f"\n⚠️  Deployment completed with status: {conclusion}")
                    return False
            
            last_status = status
        else:
            # Print progress dots
            print(".", end="", flush=True)
        
        time.sleep(5)  # Poll every 5 seconds

def main():
    print("--- SBA Pro Master GitHub Deploy Script ---\n")

    # 1. Initialize Git if needed
    if subprocess.run("git status", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode != 0:
        print("Initializing Git repository...")
        if not run_command("git init", "Failed to initialize Git"): return
    else:
        print("Git repository already initialized.")

    # 2. Add files
    print("\nAdding files to staging...")
    if not run_command("git add .", "Failed to add files"): return

    # 3. Commit
    print("\nCommitting changes...")
    # Check if there are changes to commit
    status = subprocess.run("git status --porcelain", shell=True, text=True, capture_output=True)
    if status.stdout.strip():
        if not run_command('git commit -m "Configure deployment for GitHub Pages"', "Failed to commit changes"): return        
    else:
        print("No changes to commit.")

    # 4. Configure Remote
    # Hardcoded GitHub configuration
    repo_name = "sbapromaster"
    username = "MYKHIL"
    git_email = "darkmic50@gmail.com"

    print(f"\nConfiguring Git with user: {username}")
    print(f"Email: {git_email}")

    # Set Git user configuration
    run_command(f'git config user.name "{username}"')
    run_command(f'git config user.email "{git_email}"')

    remote_url = f"https://github.com/{username}/{repo_name}.git"

    # Check if remote exists
    remotes = subprocess.run("git remote", shell=True, text=True, capture_output=True).stdout
    if "origin" in remotes:
        print(f"Updating remote 'origin' to {remote_url}")
        run_command(f"git remote set-url origin {remote_url}")
    else:
        print(f"Adding remote 'origin': {remote_url}")
        run_command(f"git remote add origin {remote_url}")

    # 5. Push
    print("\nPushing to GitHub automatically...")
    print(f"Repository: {username}/{repo_name}")

    # Ensure main branch
    run_command("git branch -M main")

    if run_command("git push -u origin main"):
        print("\n-----------------------------------")
        print("SUCCESS! Code pushed to GitHub.")
        print("-----------------------------------")
        
        # NEW: Monitor the deployment
        deployment_success = monitor_deployment(username, repo_name, max_wait_minutes=10)
        
        if not deployment_success:
            print("\nNote: You can manually check the deployment status at:")
            print(f"https://github.com/{username}/{repo_name}/actions")
    else:
        print("\n-----------------------------------")
        print("PUSH FAILED.")
        print("-----------------------------------")
        print("Common reasons:")
        print(f"1. The repository '{repo_name}' does not exist on your GitHub account ({username or 'unknown'}).")
        print("   -> Go to https://github.com/new and create it.")
        print("2. You do not have permission or are not logged in.")

        # Get current git email for debugging
        git_email = subprocess.run("git config user.email", shell=True, text=True, capture_output=True).stdout.strip()
        print(f"   (Git is currently configured with email: {git_email or 'Not configured'})")

        print("   -> Try running 'git push -u origin main' manually to see the error.")

if __name__ == "__main__":
    main()
