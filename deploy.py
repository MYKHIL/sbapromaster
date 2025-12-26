import subprocess
import os
import sys
import shutil

# Configuration
USERNAME = "MYKHIL"
GIT_EMAIL = "darkmic50@gmail.com"

# Paths (Relative to script location or absolute as fallback)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_PRO_PATH = BASE_DIR
APPROVAL_PATH = os.path.abspath(os.path.join(BASE_DIR, "..", "SBA Web Approval"))
MY_WEBSITE_PATH = os.path.abspath(os.path.join(BASE_DIR, "..", "My website"))

def run_command(command, cwd=None, error_message=None):
    try:
        # Run command and print output
        process = subprocess.run(command, shell=True, check=True, text=True, cwd=cwd)
        return True
    except subprocess.CalledProcessError as e:
        if error_message:
            print(f"Error: {error_message}")
        else:
            print(f"Command failed: {command}")
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

def deploy_pro_master():
    print("\n🚀 DEPLOYING: SBA Pro Master - Web")
    print("-----------------------------------")
    
    if not os.path.exists(WEB_PRO_PATH):
        print(f"❌ Error: Path not found {WEB_PRO_PATH}")
        return False

    if not check_git_lock(WEB_PRO_PATH): return False

    # Initialize Git if needed
    if not os.path.exists(os.path.join(WEB_PRO_PATH, ".git")):
        run_command("git init", cwd=WEB_PRO_PATH)

    configure_git(WEB_PRO_PATH)
    
    # Add and Commit
    run_command("git add .", cwd=WEB_PRO_PATH)
    status = subprocess.run("git status --porcelain", shell=True, text=True, capture_output=True, cwd=WEB_PRO_PATH)
    if status.stdout.strip():
        run_command('git commit -m "Deployment Update"', cwd=WEB_PRO_PATH)
    
    repo_name = "sbapromaster"
    remote_url = f"https://github.com/{USERNAME}/{repo_name}.git"
    
    # Configure Remote
    remotes = subprocess.run("git remote", shell=True, text=True, capture_output=True, cwd=WEB_PRO_PATH).stdout
    if "origin" in remotes:
        run_command(f"git remote set-url origin {remote_url}", cwd=WEB_PRO_PATH)
    else:
        run_command(f"git remote add origin {remote_url}", cwd=WEB_PRO_PATH)
    
    run_command("git branch -M main", cwd=WEB_PRO_PATH)
    
    print(f"Pushing to https://github.com/{USERNAME}/{repo_name}...")
    if run_command("git push -u origin main", cwd=WEB_PRO_PATH):
        print("\n✅ SUCCESS: SBA Pro Master Web pushed to GitHub.")
        print("\n[Manual Action Required]")
        print(f"1. Visit: https://github.com/{USERNAME}/{repo_name}/settings/pages")
        print("2. Ensure 'Build and deployment' source is set to 'GitHub Actions'.")
        return True
    else:
        print("\n❌ FAILED: Push rejected. Ensure the repository exists at GitHub.")
        return False

def deploy_approval():
    print("\n🚀 DEPLOYING: SBA Web Approval (to User Pages)")
    print("-----------------------------------")

    # 1. Check if SBA Web Approval exists locally
    if not os.path.exists(APPROVAL_PATH):
        print(f"Creating project folder: {APPROVAL_PATH}")
        os.makedirs(APPROVAL_PATH, exist_ok=True)
        # Create a placeholder if totally empty
        if not os.listdir(APPROVAL_PATH):
            with open(os.path.join(APPROVAL_PATH, "index.html"), "w", encoding="utf-8") as f:
                f.write("<!DOCTYPE html><html><body><h1>SBA Web Approval Portal</h1></body></html>")
    
    # 2. Check if Main Website exists
    if not os.path.exists(MY_WEBSITE_PATH):
        print(f"❌ Error: Main website repo not found at {MY_WEBSITE_PATH}")
        print("Please ensure 'd:\\Projects\\My website' exists.")
        return False

    # 3. Copy files to /approvesba
    target_dir = os.path.join(MY_WEBSITE_PATH, "approvesba")
    os.makedirs(target_dir, exist_ok=True)
    
    # Find the main file (user deleted license-portal.html, so we look for index.html)
    source_file = os.path.join(APPROVAL_PATH, "index.html")
    if not os.path.exists(source_file):
        # Fallback to any html file if index isn't there
        html_files = [f for f in os.listdir(APPROVAL_PATH) if f.endswith(".html")]
        if html_files:
            source_file = os.path.join(APPROVAL_PATH, html_files[0])
        else:
            print("❌ Error: No HTML files found in SBA Web Approval folder.")
            return False

    print(f"Copying {os.path.basename(source_file)} to approvals folder...")
    shutil.copy2(source_file, os.path.join(target_dir, "index.html"))
    
    # 4. Deploy Main Website
    if not check_git_lock(MY_WEBSITE_PATH): return False
    
    configure_git(MY_WEBSITE_PATH)
    run_command("git add .", cwd=MY_WEBSITE_PATH)
    status = subprocess.run("git status --porcelain", shell=True, text=True, capture_output=True, cwd=MY_WEBSITE_PATH)
    
    if status.stdout.strip():
        run_command('git commit -m "Update SBA Web Approval portal (/approvesba)"', cwd=MY_WEBSITE_PATH)
    else:
        print("No changes detected in website repository.")

    repo_name = "mykhil.github.io"
    remote_url = f"https://github.com/{USERNAME}/{repo_name}.git"

    # Configure Remote
    remotes = subprocess.run("git remote", shell=True, text=True, capture_output=True, cwd=MY_WEBSITE_PATH).stdout
    if "origin" in remotes:
        run_command(f"git remote set-url origin {remote_url}", cwd=MY_WEBSITE_PATH)
    else:
        run_command(f"git remote add origin {remote_url}", cwd=MY_WEBSITE_PATH)

    run_command("git branch -M main", cwd=MY_WEBSITE_PATH)

    print(f"Pushing to https://github.com/{USERNAME}/{repo_name}...")
    if run_command("git push origin main", cwd=MY_WEBSITE_PATH):
        print("\n✅ SUCCESS: SBA Web Approval is now live!")
        print(f"URL: https://{USERNAME.lower()}.github.io/approvesba")
        return True
    else:
        print("\n❌ FAILED: Push rejected. Ensure the repository exists at GitHub.")
        return False

def main():
    while True:
        print("\n==============================================")
        print("      SBA UNIFIED DEPLOYMENT MANAGER")
        print("==============================================")
        print("Which project(s) do you want to deploy?")
        print("[1] SBA Pro Master - Web      (sbapromaster.git)")
        print("[2] SBA Web Approval Portal   (mykhil.github.io/approvesba)")
        print("[3] Both Projects")
        print("[Q] Quit")
        
        choice = input("\nEnter choice (1/2/3/Q): ").strip().upper()
        
        if choice == '1':
            deploy_pro_master()
        elif choice == '2':
            deploy_approval()
        elif choice == '3':
            res1 = deploy_pro_master()
            res2 = deploy_approval()
        elif choice == 'Q':
            print("Goodbye!")
            break
        else:
            print("Invalid selection. Please try again.")

if __name__ == "__main__":
    main()
