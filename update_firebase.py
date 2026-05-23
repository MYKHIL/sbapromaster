import re
import os
import sys
import subprocess
import random
import json
import urllib.request
import urllib.parse

def get_existing_slots(lines):
    slots = set()
    for line in lines:
        match = re.match(r'^FIREBASE_(\d+)_API_KEY=', line.strip())
        if match:
            slots.add(int(match.group(1)))
    return sorted(list(slots))

def update_env(file_path, config, slot_number, is_new, email=None, token=None):
    if not os.path.exists(file_path):
        print(f"Error: .env file not found at {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    mapping = {
        'apiKey': f'FIREBASE_{slot_number}_API_KEY',
        'authDomain': f'FIREBASE_{slot_number}_AUTH_DOMAIN',
        'projectId': f'FIREBASE_{slot_number}_PROJECT_ID',
        'storageBucket': f'FIREBASE_{slot_number}_STORAGE_BUCKET',
        'messagingSenderId': f'FIREBASE_{slot_number}_MESSAGING_SENDER_ID',
        'appId': f'FIREBASE_{slot_number}_APP_ID',
        'measurementId': f'FIREBASE_{slot_number}_MEASUREMENT_ID'
    }

    comment_line = f"# Firebase Configuration - Database {slot_number}"
    if email:
        comment_line += f" ({email})"
    comment_line += "\n"

    token_key = f"FIREBASE_{slot_number}_TOKEN"

    if is_new:
        if lines and not lines[-1].endswith('\n'):
            lines[-1] += '\n'
        # Append new block
        new_lines = [
            f"\n{comment_line}",
            f"{mapping['apiKey']}={config.get('apiKey', '')}\n",
            f"{mapping['authDomain']}={config.get('authDomain', '')}\n",
            f"{mapping['projectId']}={config.get('projectId', '')}\n",
            f"{mapping['storageBucket']}={config.get('storageBucket', '')}\n",
            f"{mapping['messagingSenderId']}={config.get('messagingSenderId', '')}\n",
            f"{mapping['appId']}={config.get('appId', '')}\n",
            f"{mapping['measurementId']}={config.get('measurementId', '')}\n"
        ]
        if token:
            new_lines.append(f"{token_key}={token}\n")
        lines.extend(new_lines)
    else:
        # Update existing
        updated_lines = []
        found_token = False
        
        for line in lines:
            comment_match = re.match(r'^#\s*Firebase\s+Configuration\s+-\s+Database\s+(\d+)\b', line.strip())
            if comment_match and int(comment_match.group(1)) == slot_number:
                updated_lines.append(comment_line)
                continue
                
            if '=' in line:
                env_key = line.split('=')[0].strip()
                if env_key == token_key:
                    if token:
                        updated_lines.append(f"{token_key}={token}\n")
                        found_token = True
                    else:
                        updated_lines.append(line)
                    continue
                
                js_key = next((k for k, v in mapping.items() if v == env_key), None)
                if js_key and js_key in config:
                    updated_lines.append(f"{env_key}={config[js_key]}\n")
                    continue
            updated_lines.append(line)
            
        if token and not found_token:
            # Append token right after the database block
            last_idx = -1
            for idx, line in enumerate(updated_lines):
                if f"FIREBASE_{slot_number}_" in line:
                    last_idx = idx
            if last_idx != -1:
                updated_lines.insert(last_idx + 1, f"{token_key}={token}\n")
            else:
                updated_lines.append(f"\n{token_key}={token}\n")
        
        lines = updated_lines

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f"Updated {file_path}")

def parse_config(js_code):
    # 1. Try to parse as JSON first
    json_start = js_code.find('{')
    json_end = js_code.rfind('}')
    if json_start != -1 and json_end != -1:
        try:
            json_text = js_code[json_start:json_end+1]
            data = json.loads(json_text)
            cleaned = {}
            for k, v in data.items():
                if isinstance(v, str):
                    cleaned[k] = v
            if 'apiKey' in cleaned:
                return cleaned
        except Exception:
            pass

    # 2. Fallback to regex (handles JS paste with optional quotes around keys)
    config = {}
    matches = re.findall(r'["\']?(\w+)["\']?:\s*["\']([^"\']+)["\']', js_code)
    for key, value in matches:
        config[key] = value
    return config

def run_login_ci():
    print("\nRunning 'npx firebase login:ci'...")
    print("Please follow the instructions in the browser window that opens.")
    try:
        cmd = "npx firebase login:ci"
        process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1, universal_newlines=True)
        
        token = None
        if process.stdout:
            found_success_msg = False
            for line in process.stdout:
                print(line, end='', flush=True)
                match = re.search(r"Success! Use this token to login on a CI server:\s+(\S+)", line)
                if match:
                    raw_token = match.group(1).strip()
                    token = re.sub(r'\x1b\[[0-9;]*[mGJKHFef]', '', raw_token)
                    break
                if "Success! Use this token to login on a CI server:" in line:
                    found_success_msg = True
                    continue
                if found_success_msg and line.strip():
                    raw_token = line.strip()
                    token = re.sub(r'\x1b\[[0-9;]*[mGJKHFef]', '', raw_token)
                    break
        process.wait()
        return token
    except Exception as e:
        print(f"Error running firebase login:ci: {e}")
        return None

def run_cli_command(cmd, cwd=None):
    try:
        process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1, universal_newlines=True, cwd=cwd)
        output_lines = []
        if process.stdout:
            for line in process.stdout:
                print(line, end='', flush=True)
                output_lines.append(line)
        process.wait()
        return process.returncode == 0, "".join(output_lines)
    except Exception as e:
        print(f"Error running command '{cmd}': {e}")
        return False, str(e)

def run_cli_command_silent(cmd, cwd=None):
    try:
        process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd=cwd)
        stdout, stderr = process.communicate()
        return process.returncode == 0, stdout
    except Exception as e:
        return False, str(e)

def get_firebase_projects(token):
    cmd = f'npx firebase projects:list --json --token "{token}"'
    success, output = run_cli_command_silent(cmd)
    if not success:
        return None
    try:
        json_start = output.find('{')
        if json_start != -1:
            output = output[json_start:]
        data = json.loads(output)
        if data.get('status') == 'success':
            return data.get('result', [])
    except Exception as e:
        print(f"Debug: JSON parsing of projects list failed: {e}")
    return None

def get_firebase_web_apps(project_id, token):
    cmd = f'npx firebase apps:list WEB --json --project {project_id} --token "{token}"'
    success, output = run_cli_command_silent(cmd)
    if not success:
        return None
    try:
        json_start = output.find('{')
        if json_start != -1:
            output = output[json_start:]
        data = json.loads(output)
        if data.get('status') == 'success':
            return data.get('result', [])
    except Exception as e:
        print(f"Debug: JSON parsing of apps list failed: {e}")
    return None

def handle_option_1(base_dir, web_pro_env, approval_env):
    print("\n--- Option 1: Import Existing Configuration ---")
    print("Paste your Firebase Configuration (JS format):")
    print("(Press Enter then Ctrl+Z on Windows or Ctrl+D on Linux/Mac to finish)")
    
    lines = []
    try:
        while True:
            line = input()
            lines.append(line)
    except EOFError:
        pass
    
    js_code = "\n".join(lines)
    config = parse_config(js_code)
    
    if not config:
        print("Error: Could not parse Firebase configuration.")
        return

    # Check existing slots from the main .env
    with open(web_pro_env, 'r', encoding='utf-8') as f:
        env_lines = f.readlines()
    
    slots = get_existing_slots(env_lines)
    
    print("\nHow would you like to apply this configuration?")
    if slots:
        print(f"Existing slots: {', '.join(map(str, slots))}")
        print("Enter slot number to UPDATE, or 'N' to ADD as a NEW slot.")
        choice = input("Choice (number/N): ").strip().upper()
    else:
        print("No existing slots found. Defaulting to ADD as slot 1.")
        choice = '1'
    
    is_new = False
    slot_number = 1
    
    if choice == 'N':
        is_new = True
        slot_number = max(slots) + 1 if slots else 1
    else:
        try:
            slot_number = int(choice)
            if slot_number not in slots:
                is_new = True
        except ValueError:
            print("Invalid input. Defaulting to ADD new.")
            is_new = True
            slot_number = max(slots) + 1 if slots else 1

    print(f"\nUpdating Database Slot {slot_number}...")
    update_env(web_pro_env, config, slot_number, is_new)
    update_env(approval_env, config, slot_number, is_new)
    print("\nDone!")

def resolve_emails(input_str):
    input_str = input_str.strip()
    if not input_str:
        return []
    
    # Check for brace expansion pattern like name{12..21}@domain.com
    match = re.search(r'\{(\d+)\.\.(\d+)\}', input_str)
    if match:
        start = int(match.group(1))
        end = int(match.group(2))
        brace_str = match.group(0)
        
        step = 1 if start <= end else -1
        emails = []
        for i in range(start, end + step, step):
            email = input_str.replace(brace_str, str(i))
            emails.append(email.strip())
        return emails
        
    # Check for comma-separated list
    if ',' in input_str:
        return [email.strip() for email in input_str.split(',') if email.strip()]
        
    # Single email
    return [input_str]

def find_existing_email_config(env_path, email):
    if not os.path.exists(env_path):
        return None, None
    
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Scan lines for "# Firebase Configuration - Database X (email)"
        for line in lines:
            line_str = line.strip()
            match = re.search(r'Database\s+(\d+)\s*\(([^)]+)\)', line_str, re.IGNORECASE)
            if match:
                slot = int(match.group(1))
                configured_email = match.group(2).strip()
                if configured_email.lower() == email.lower():
                    # Found slot! Now find token if it exists in the file
                    token_key = f"FIREBASE_{slot}_TOKEN"
                    token_val = None
                    for l in lines:
                        if l.strip().startswith(f"{token_key}="):
                            token_val = l.split('=', 1)[1].strip()
                            break
                    return slot, token_val
    except Exception:
        pass
    return None, None

def get_project_id_from_env(env_path, slot):
    if not slot or not os.path.exists(env_path):
        return None
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip().startswith(f"FIREBASE_{slot}_PROJECT_ID="):
                    return line.split('=', 1)[1].strip()
    except Exception:
        pass
    return None

def clean_up_a_projects(token):
    """
    Looks for any project whose ID consists only of the letter 'a' (like 'aaa', 'aaaaa')
    and requests its deletion using the GCP Resource Manager API.
    """
    print("\n--- Cleaning up temporary 'a' projects (aaa, aaaaa, etc.) ---")
    url = "https://oauth2.googleapis.com/token"
    client_id = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
    client_secret = "j9iVZfS8kkCEFUPaAeJV0sAi"
    
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "refresh_token",
        "refresh_token": token
    }
    
    req_data = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(url, data=req_data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    access_token = None
    try:
        with urllib.request.urlopen(req, context=ctx) as res:
            res_data = json.loads(res.read().decode("utf-8"))
            access_token = res_data.get("access_token")
    except Exception as e:
        print(f"  Warning: Could not exchange token for GCP APIs: {e}")
        return
        
    if not access_token:
        return
        
    list_url = "https://cloudresourcemanager.googleapis.com/v1/projects"
    list_req = urllib.request.Request(list_url, method="GET")
    list_req.add_header("Authorization", f"Bearer {access_token}")
    
    try:
        with urllib.request.urlopen(list_req, context=ctx) as res:
            res_data = json.loads(res.read().decode("utf-8"))
            projects = res_data.get("projects", [])
            for p in projects:
                pid = p.get("projectId", "")
                lifecycle = p.get("lifecycleState", "")
                
                # Check for projects whose ID is repeating 'a's (at least 3 characters) optionally followed by a suffix
                if re.match(r'^a{3,}(?:-\w+)?$', pid, re.IGNORECASE) and lifecycle == "ACTIVE":
                    print(f"  [WARNING] Found temporary project: {pid} (lifecycle: {lifecycle}). Deleting...")
                    del_url = f"https://cloudresourcemanager.googleapis.com/v1/projects/{pid}"
                    del_req = urllib.request.Request(del_url, method="DELETE")
                    del_req.add_header("Authorization", f"Bearer {access_token}")
                    
                    try:
                        with urllib.request.urlopen(del_req, context=ctx) as del_res:
                            print(f"  [SUCCESS] Successfully requested deletion for project: {pid}")
                    except Exception as del_err:
                        print(f"  [ERROR] Failed to delete project {pid}: {del_err}")
    except Exception as e:
        print(f"  Warning: Failed to list projects for cleanup: {e}")

def handle_option_2(base_dir, web_pro_env, approval_env):
    print("\n--- Option 2: Create and Configure a New Project ---")
    
    email_input = input("Enter Google/Firebase email(s) or pattern (e.g. 'my@gmail.com' or 'my{12..21}@gmail.com'): ").strip()
    if not email_input:
        print("Error: Email address is required.")
        return
        
    emails = resolve_emails(email_input)
    if not emails:
        print("Error: No valid email addresses found.")
        return
        
    print(f"\nResolved {len(emails)} email address(es):")
    for e in emails:
        print(f"  - {e}")
        
    use_defaults = input("\nUse defaults for the remaining project details? (y/n, default: y): ").strip().lower()
    global_use_defaults = (use_defaults in ['', 'y', 'yes'])
    
    custom_project_id = None
    custom_display_name = None
    custom_location = None
    custom_app_name = None
    
    customize_each = False
    if not global_use_defaults and len(emails) > 1:
        cust_choice = input("Customize each project individually, or apply same settings (names/regions) to all? (individual/all, default: all): ").strip().lower()
        if cust_choice in ['individual', 'i']:
            customize_each = True
            
    if not global_use_defaults and not customize_each:
        print("\n--- Configure Base Details for All Projects ---")
        custom_display_name = input("Enter project display name (default: SBA Pro Master): ").strip() or "SBA Pro Master"
        custom_location = input("Enter database location/region (default: nam5): ").strip() or "nam5"
        custom_app_name = input("Enter Web App display name (default: SBA Pro Master Web): ").strip() or "SBA Pro Master Web"

    for idx, email in enumerate(emails, 1):
        print(f"\n==================================================")
        print(f" PROCESSING EMAIL {idx}/{len(emails)}: {email}")
        print(f"==================================================")
        
        # Suggest a default project ID
        suffix = "".join(random.choices("0123456789abcdef", k=5))
        default_project_id = f"sba-pro-master-{suffix}"
        
        if global_use_defaults:
            project_id = default_project_id
            display_name = "SBA Pro Master"
            location = "nam5"
            app_name = "SBA Pro Master Web"
        elif customize_each:
            print(f"\n--- Customize Settings for {email} ---")
            project_id = input(f"Enter Firebase Project ID (default: {default_project_id}): ").strip() or default_project_id
            display_name = input("Enter project display name (default: SBA Pro Master): ").strip() or "SBA Pro Master"
            location = input("Enter database location/region (default: nam5): ").strip() or "nam5"
            app_name = input("Enter Web App display name (default: SBA Pro Master Web): ").strip() or "SBA Pro Master Web"
        else:
            project_id = default_project_id
            display_name = custom_display_name
            location = custom_location
            app_name = custom_app_name
            
        print(f"Target Details for {email}:")
        print(f"  - Project ID: {project_id}")
        print(f"  - Display Name: {display_name}")
        print(f"  - Database Location: {location}")
        print(f"  - Web App Name: {app_name}")
        
        # 1. Check if token already exists in .env for this email
        existing_slot, token = find_existing_email_config(web_pro_env, email)
        if token:
            print(f"\n[KEY] Found existing token for {email} in slot {existing_slot}. Using it.")
        else:
            print(f"\n[KEY] No existing token found for {email}.")
            print("\n--- Step 1: Firebase Token Generation ---")
            print(f"We need a Firebase token to run commands on behalf of: {email}")
            confirm = input(f"Would you like to run 'firebase login:ci' to login to {email}? (y/n, default: y): ").strip().lower()
            if confirm in ['', 'y', 'yes']:
                token = run_login_ci()
            if not token:
                token = input("Please paste your Firebase CI token manually: ").strip()
            if not token:
                print(f"[ERROR] Error: A token is required to configure project for {email}. Skipping.")
                continue

        # Check if email is already configured in a slot and extract project ID
        env_project_id = get_project_id_from_env(web_pro_env, existing_slot)
        if env_project_id:
            project_id = env_project_id
            print(f"[INFO] Target Project ID from .env: {project_id}")

        # 2. Check existing projects
        print("\nChecking existing Firebase projects on your account...")
        existing_projects = get_firebase_projects(token)
        use_existing = False
        
        if existing_projects is not None:
            exact_match = next((p for p in existing_projects if p['projectId'].lower() == project_id.lower()), None)
            if exact_match:
                print(f"Found exact match for project ID '{project_id}' on this account. Reusing it automatically.")
                use_existing = True
            else:
                variants = [p for p in existing_projects if "sba-pro-master" in p['projectId'].lower()]
                if variants:
                    project_id = variants[0]['projectId']
                    display_name = variants[0]['displayName']
                    use_existing = True
                    print(f"Automatically reusing existing project found on account: {display_name} ({project_id})")

        # Create project if not using existing
        if not use_existing:
            print("\n--- Step 2: Creating Firebase Project ---")
            print(f"Creating project '{project_id}' ({display_name})...")
            create_cmd = f'npx firebase projects:create {project_id} --display-name "{display_name}" --token "{token}"'
            success, output = run_cli_command(create_cmd, cwd=base_dir)
            if not success:
                print("\n[ERROR] Error: Project creation failed.")
                if "permission" in output.lower() or "403" in output:
                    print("\n[TIP] TROUBLESHOOTING TIP: This 403 PERMISSION_DENIED error usually means that the Google account")
                    print(f"   '{email}' has not accepted the Firebase Terms of Service yet.")
                    print("   To fix this:")
                    print("   1. Open a web browser and go to the Firebase Console: https://console.firebase.google.com/")
                    print(f"   2. Log in with your email address: {email}")
                    print("   3. Accept the Terms of Service when prompted (or try creating a temporary/dummy project).")
                    print(f"   4. Once accepted, rerun this script.")
                continue
        else:
            print(f"\n--- Step 2: Using Existing Project '{project_id}' (Skipping Creation) ---")

        # Always clean up any temporary 'a' projects (aaa, aaaaa, etc.)
        clean_up_a_projects(token)

        # Create database
        print("\n--- Step 3: Ensuring Firestore Database ---")
        print(f"Ensuring '(default)' Firestore database in '{location}'...")
        db_cmd = f'npx firebase firestore:databases:create "(default)" --location {location} --project {project_id} --token "{token}"'
        
        import time
        db_success = False
        for attempt in range(1, 4):
            if attempt > 1:
                print(f"Retrying Firestore database creation (Attempt {attempt}/3)...")
            success, output = run_cli_command(db_cmd, cwd=base_dir)
            if success:
                db_success = True
                break
            elif "already exists" in output.lower():
                print("Firestore database '(default)' already exists. Proceeding.")
                db_success = True
                break
            elif "not been used" in output.lower() or "disabled" in output.lower() or "propagate" in output.lower():
                print("[WAIT] Firestore API is initializing on Google Cloud. Waiting 15 seconds for propagation...")
                time.sleep(15)
            else:
                print("[WAIT] Encountered an error. Waiting 10 seconds before retrying...")
                time.sleep(10)
                
        if not db_success:
            print("Warning: Firestore database creation returned an error. Attempting to proceed.")

        # Ensure Web App exists or create one
        print("\n--- Step 4: Ensuring Firebase Web App ---")
        apps = get_firebase_web_apps(project_id, token)
        app_id = None
        if apps:
            app_id = apps[0].get('appId')
            app_name_existing = apps[0].get('displayName')
            print(f"Found existing Web App: {app_name_existing} ({app_id})")
        else:
            print(f"Creating new Web App '{app_name}'...")
            app_cmd = f'npx firebase apps:create web "{app_name}" --project {project_id} --token "{token}"'
            success, output = run_cli_command(app_cmd, cwd=base_dir)
            if not success:
                print("Error: Web App creation failed. Skipping this project.")
                continue

        # Get SDK Configuration
        print("\n--- Step 5: Retrieving Web SDK Configuration ---")
        if app_id:
            sdk_cmd = f'npx firebase apps:sdkconfig web {app_id} --project {project_id} --token "{token}"'
        else:
            sdk_cmd = f'npx firebase apps:sdkconfig web --project {project_id} --token "{token}"'
        success, output = run_cli_command(sdk_cmd, cwd=base_dir)
        if not success:
            print("Error: Could not retrieve SDK configuration. Skipping this project.")
            continue
            
        config = parse_config(output)
        if not config or 'apiKey' not in config:
            print("Error: Could not parse Firebase configuration from output. Skipping this project.")
            continue

        # Copy firestore rules to the project
        print("\n--- Step 6: Deploying Firestore Rules ---")
        rules_file = os.path.join(base_dir, "firestore.rules")
        if os.path.exists(rules_file):
            print(f"Deploying rules from '{rules_file}'...")
            rules_cmd = f'npx firebase deploy --only firestore:rules --project {project_id} --token "{token}"'
            success, output = run_cli_command(rules_cmd, cwd=base_dir)
            if not success:
                print("Warning: Firestore rules deployment failed. You can deploy rules later using deploy.py.")
        else:
            print(f"Warning: firestore.rules not found at '{rules_file}'. Skipping rules deployment.")

        # Determine Slot Number
        if existing_slot:
            slot_number = existing_slot
            is_new_slot = False
            print(f"Reusing existing Database Slot {slot_number} for {email}.")
        else:
            with open(web_pro_env, 'r', encoding='utf-8') as f:
                env_lines = f.readlines()
            slots = get_existing_slots(env_lines)
            next_slot = max(slots) + 1 if slots else 1
            
            print(f"\nNext available Database Slot is: {next_slot}")
            slot_choice = input(f"Enter slot number to write {email} config to (default: {next_slot}): ").strip()
            if slot_choice:
                try:
                    slot_number = int(slot_choice)
                except ValueError:
                    print(f"Invalid input. Defaulting to Slot {next_slot}.")
                    slot_number = next_slot
            else:
                slot_number = next_slot
            is_new_slot = slot_number not in slots

        # Update .env files
        print("\n--- Step 7: Updating Environment Files ---")
        update_env(web_pro_env, config, slot_number, is_new_slot, email, token)
        update_env(approval_env, config, slot_number, is_new_slot, email, token)
        
        print(f"\n[SUCCESS] Project for {email} successfully configured in Slot {slot_number}!")

    print("\n[DONE] Batch process complete!")

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    web_pro_env = os.path.join(base_dir, ".env")
    approval_env = os.path.abspath(os.path.join(base_dir, "..", "SBA Web Approval", ".env"))
    
    print("==================================================")
    print("        FIREBASE CONFIGURATION MANAGER            ")
    print("==================================================")
    print("Please choose an option:")
    print("[1] Import existing Firebase configuration (Paste JS config)")
    print("[2] Create and configure a new Firebase project")
    
    choice = input("\nEnter choice (1/2): ").strip()
    if choice == '1':
        handle_option_1(base_dir, web_pro_env, approval_env)
    elif choice == '2':
        handle_option_2(base_dir, web_pro_env, approval_env)
    else:
        print("Invalid choice. Exiting.")

if __name__ == "__main__":
    main()
