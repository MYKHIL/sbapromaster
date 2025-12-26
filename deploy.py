import subprocess
import os
import sys
import shutil

# Configuration
USERNAME = "MYKHIL"
GIT_EMAIL = "darkmic50@gmail.com"

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_PRO_PATH = BASE_DIR
APPROVAL_PATH = os.path.abspath(os.path.join(BASE_DIR, "..", "SBA Web Approval"))

def run_command(command, cwd=None, error_message=None):
    try:
        process = subprocess.run(command, shell=True, check=True, text=True, cwd=cwd)
        return True
    except subprocess.CalledProcessError as e:
        if error_message:
            print(f"Error: {error_message}")
        return False

def check_git_lock(path):
    lock_file = os.path.join(path, ".git", "index.lock")
    if os.path.exists(lock_file):
        print(f"\n⚠️  WARNING: Git lock file detected in {path}!")
        response = input("Remove lock file and proceed? (y/n): ").lower().strip()
        if response in ['y', 'yes']:
            try:
                os.remove(lock_file)
                print("✓ Lock file removed successfully.")
                return True
            except Exception as e:
                print(f"✗ Failed to remove lock file: {e}")
                return False
        return False
    return True

def configure_git(cwd):
    run_command(f'git config user.name "{USERNAME}"', cwd=cwd)
    run_command(f'git config user.email "{GIT_EMAIL}"', cwd=cwd)

def push_with_retry(cwd, repo_name, branch="main"):
    print(f"\nPushing to https://github.com/{USERNAME}/{repo_name}...")
    
    # Check if remote exists first (ls-remote)
    remote_exists = run_command(f"git ls-remote https://github.com/{USERNAME}/{repo_name}.git", cwd=cwd)
    
    if not remote_exists:
        print(f"\n⚠️  REPOSITORY NOT FOUND: {USERNAME}/{repo_name}")
        print(f"Please create it manually at: https://github.com/new")
        print(f"Name the repository precisely: {repo_name}")
        print("After creating it, run this script again.")
        return False

    # Try regular push
    success = run_command(f"git push -u origin {branch}", cwd=cwd)
    
    if success:
        return True
    
    print("\n⚠️  PUSH REJECTED: Your local repository is out of sync with GitHub.")
    print("[1] Pull & Rebase")
    print("[2] Force Push (Overwrite GitHub)")
    print("[3] Abort")
    
    choice = input("\nEnter choice (1/2/3): ").strip()
    
    if choice == '1':
        if run_command(f"git pull --rebase origin {branch}", cwd=cwd):
            return run_command(f"git push -u origin {branch}", cwd=cwd)
    elif choice == '2':
        confirm = input("Confirm Force Push? (y/n): ").lower().strip()
        if confirm == 'y':
            return run_command(f"git push -u origin {branch} --force", cwd=cwd)
            
    return False

def deploy_pro_master():
    print("\n🚀 DEPLOYING: SBA Pro Master - Web")
    print("-----------------------------------")
    if not check_git_lock(WEB_PRO_PATH): return False
    if not os.path.exists(os.path.join(WEB_PRO_PATH, ".git")):
        run_command("git init", cwd=WEB_PRO_PATH)

    configure_git(WEB_PRO_PATH)
    run_command("git add .", cwd=WEB_PRO_PATH)
    status = subprocess.run("git status --porcelain", shell=True, text=True, capture_output=True, cwd=WEB_PRO_PATH)
    if status.stdout.strip():
        run_command('git commit -m "Deployment Update"', cwd=WEB_PRO_PATH)
    
    repo_name = "sbapromaster"
    remote_url = f"https://github.com/{USERNAME}/{repo_name}.git"
    
    remotes = subprocess.run("git remote", shell=True, text=True, capture_output=True, cwd=WEB_PRO_PATH).stdout
    if "origin" in remotes:
        run_command(f"git remote set-url origin {remote_url}", cwd=WEB_PRO_PATH)
    else:
        run_command(f"git remote add origin {remote_url}", cwd=WEB_PRO_PATH)
    
    run_command("git branch -M main", cwd=WEB_PRO_PATH)
    
    if push_with_retry(WEB_PRO_PATH, repo_name):
        print("\n✅ SUCCESS: SBA Pro Master Web pushed to GitHub.")
        return True
    return False

def deploy_approval():
    print("\n🚀 DEPLOYING: SBA Web Approval (Standalone)")
    print("-----------------------------------")

    # Ensure local path exists
    if not os.path.exists(APPROVAL_PATH):
        print(f"Folder not found. Creating: {APPROVAL_PATH}")
        os.makedirs(APPROVAL_PATH, exist_ok=True)
        with open(os.path.join(APPROVAL_PATH, "index.html"), "w", encoding="utf-8") as f:
            f.write("<!DOCTYPE html><html><body><h1>SBA Web Approval Portal</h1></body></html>")
    
    if not check_git_lock(APPROVAL_PATH): return False

    # Initialize Git if needed
    if not os.path.exists(os.path.join(APPROVAL_PATH, ".git")):
        print("Initializing Git in SBA Web Approval...")
        run_command("git init", cwd=APPROVAL_PATH)

    configure_git(APPROVAL_PATH)
    run_command("git add .", cwd=APPROVAL_PATH)
    status = subprocess.run("git status --porcelain", shell=True, text=True, capture_output=True, cwd=APPROVAL_PATH)
    if status.stdout.strip():
        run_command('git commit -m "Deployment Update"', cwd=APPROVAL_PATH)
    
    repo_name = "approvesba"
    remote_url = f"https://github.com/{USERNAME}/{repo_name}.git"

    # Configure Remote
    remotes = subprocess.run("git remote", shell=True, text=True, capture_output=True, cwd=APPROVAL_PATH).stdout
    if "origin" in remotes:
        run_command(f"git remote set-url origin {remote_url}", cwd=APPROVAL_PATH)
    else:
        run_command(f"git remote add origin {remote_url}", cwd=APPROVAL_PATH)

    run_command("git branch -M main", cwd=APPROVAL_PATH)

    if push_with_retry(APPROVAL_PATH, repo_name):
        print("\n✅ SUCCESS: SBA Web Approval is now live!")
        print(f"URL: https://{USERNAME.lower()}.github.io/approvesba")
        print("\n[IMPORTANT ACTION]")
        print("Go to Settings > Pages for the 'approvesba' repo and ensure the source is 'Deploy from branch (main)'.")
        return True
    return False

def main():
    while True:
        try:
            print("\n==============================================")
            print("      SBA UNIFIED DEPLOYMENT MANAGER")
            print("==============================================")
            print("Which project(s) do you want to deploy?")
            print("[1] SBA Pro Master - Web      (sbapromaster.git)")
            print("[2] SBA Web Approval Portal   (approvesba.git)")
            print("[3] Both Projects")
            print("[Q] Quit")
            
            choice = input("\nEnter choice (1/2/3/Q): ").strip().upper()
            
            if choice == '1':
                deploy_pro_master()
            elif choice == '2':
                deploy_approval()
            elif choice == '3':
                deploy_pro_master()
                deploy_approval()
            elif choice == 'Q':
                print("Goodbye!")
                break
            else:
                print("Invalid selection. Please try again.")
        except KeyboardInterrupt:
            print("\nOperation cancelled.")
            break

if __name__ == "__main__":
    main()
