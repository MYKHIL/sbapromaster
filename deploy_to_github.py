import subprocess
import os
import sys

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

def main():
    print("--- SBA Pro Master GitHub Deploy Script ---")
    
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
    # Try to get current remote
    current_remote = subprocess.run("git remote get-url origin", shell=True, text=True, capture_output=True).stdout.strip()
    
    repo_name = "sbapromaster"
    username = ""
    
    if current_remote:
        print(f"\nCurrent remote origin: {current_remote}")
        choice = input("Do you want to use this remote? (y/n): ").lower()
        if choice != 'y':
            current_remote = ""
    
    if not current_remote:
        username = input("\nEnter your GitHub username: ").strip()
        if not username:
            print("Username is required to configure remote.")
            return
        
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
    print("\nPushing to GitHub...")
    print("Note: You may be asked to sign in to GitHub in a browser or enter credentials.")
    
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
        print("1. The repository 'sbapromaster' does not exist on your GitHub account.")
        print("   -> Go to https://github.com/new and create it.")
        print("2. You do not have permission or are not logged in.")
        print("   -> Try running 'git push -u origin main' manually to see the error.")

if __name__ == "__main__":
    main()
