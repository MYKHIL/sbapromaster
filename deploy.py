import subprocess
import os
import sys
import re

def run_command(command, error_message=None):
    try:
        # Run command and print output in real-time
        process = subprocess.run(command, shell=True, check=True, text=True)
        return True
    except subprocess.CalledProcessError as e:
        if error_message:
            print(f"Error: {error_message}")
        else:
            print(f"Command failed: {command}")
        return False

def check_and_remove_git_lock():
    """Check for Git lock file and prompt user to remove it if found."""
    lock_file = ".git/index.lock"
    if os.path.exists(lock_file):
        print("\n⚠️  WARNING: Git lock file detected!")
        print(f"Lock file location: {os.path.abspath(lock_file)}")
        print("\nThis usually happens when a Git process was interrupted or crashed.")
        print("Removing this lock file is safe if no other Git process is currently running.")
        
        response = input("\nDo you want to remove the lock file and proceed? (y/n): ").lower().strip()
        
        if response == 'y' or response == 'yes':
            try:
                os.remove(lock_file)
                print("✓ Lock file removed successfully.")
                return True
            except Exception as e:
                print(f"✗ Failed to remove lock file: {e}")
                return False
        else:
            print("Deployment cancelled. Please ensure no Git processes are running and try again.")
            return False
    return True

def main():
    print("--- SBA Pro Master GitHub Deploy Script ---")
    
    # Check for Git lock file before proceeding
    if not check_and_remove_git_lock():
        return
    
    # 1. Initialize Git if needed
    if not os.path.exists(".git"):
        print("\nInitializing Git repository...")
        if not run_command("git init", "Failed to initialize git repository"): return
    else:
        print("\nGit repository already initialized.")

    # 2. Add all files
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
        print("Next Steps:")
        print(f"1. Go to your repository settings: https://github.com/{username or '<username>'}/{repo_name}/settings/pages")
        print("2. Under 'Build and deployment', select 'GitHub Actions' as the source.")
        print("   (The workflow file .github/workflows/deploy.yml has been created for you)")
        print("3. Wait for the Action to complete, and your site will be live!")
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
