import re
import os

def get_existing_slots(lines):
    slots = set()
    for line in lines:
        match = re.match(r'^FIREBASE_(\d+)_API_KEY=', line.strip())
        if match:
            slots.add(int(match.group(1)))
    return sorted(list(slots))

def update_env(file_path, config, slot_number, is_new):
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

    if is_new:
        # Append new block
        new_lines = [
            f"\n# Firebase Configuration - Database {slot_number}\n",
            f"{mapping['apiKey']}={config.get('apiKey', '')}\n",
            f"{mapping['authDomain']}={config.get('authDomain', '')}\n",
            f"{mapping['projectId']}={config.get('projectId', '')}\n",
            f"{mapping['storageBucket']}={config.get('storageBucket', '')}\n",
            f"{mapping['messagingSenderId']}={config.get('messagingSenderId', '')}\n",
            f"{mapping['appId']}={config.get('appId', '')}\n",
            f"{mapping['measurementId']}={config.get('measurementId', '')}\n"
        ]
        lines.extend(new_lines)
    else:
        # Update existing
        updated_lines = []
        pattern = f'FIREBASE_{slot_number}_'
        for line in lines:
            if line.strip().startswith(pattern):
                env_key = line.split('=')[0].strip()
                # Find which JS key this env_key corresponds to
                js_key = next((k for k, v in mapping.items() if v == env_key), None)
                if js_key and js_key in config:
                    updated_lines.append(f"{env_key}={config[js_key]}\n")
                    continue
            updated_lines.append(line)
        lines = updated_lines

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f"Updated {file_path}")

def parse_config(js_code):
    config = {}
    matches = re.findall(r'(\w+):\s*["\']([^"\']+)["\']', js_code)
    for key, value in matches:
        config[key] = value
    return config

def main():
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

    base_dir = os.path.dirname(os.path.abspath(__file__))
    web_pro_env = os.path.join(base_dir, ".env")
    
    # Check existing slots from the main .env
    with open(web_pro_env, 'r', encoding='utf-8') as f:
        env_lines = f.readlines()
    
    slots = get_existing_slots(env_lines)
    
    print("\nHow would you like to apply this configuration?")
    if slots:
        print(f"Existing slots: {', '.join(map(str, slots))}")
        print("Enter slot number to UPDATE, or 'N' to ADD as a NEW slot.")
    else:
        print("No existing slots found. Defaulting to ADD as slot 1.")
        choice = '1'

    choice = input("Choice (number/N): ").strip().upper()
    
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

    approval_env = os.path.abspath(os.path.join(base_dir, "..", "SBA Web Approval", ".env"))

    print(f"\nUpdating Database Slot {slot_number}...")
    update_env(web_pro_env, config, slot_number, is_new)
    update_env(approval_env, config, slot_number, is_new)
    print("\nDone!")

if __name__ == "__main__":
    main()
