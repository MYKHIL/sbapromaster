import re
import os

def update_env(file_path, config):
    if not os.path.exists(file_path):
        print(f"Error: .env file not found at {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    updated_lines = []
    found_keys = set()
    
    # Map Firebase JS config keys to .env keys
    mapping = {
        'apiKey': 'FIREBASE_1_API_KEY',
        'authDomain': 'FIREBASE_1_AUTH_DOMAIN',
        'projectId': 'FIREBASE_1_PROJECT_ID',
        'storageBucket': 'FIREBASE_1_STORAGE_BUCKET',
        'messagingSenderId': 'FIREBASE_1_MESSAGING_SENDER_ID',
        'appId': 'FIREBASE_1_APP_ID',
        'measurementId': 'FIREBASE_1_MEASUREMENT_ID'
    }

    for line in lines:
        match = re.match(r'^(FIREBASE_1_\w+)=.*', line.strip())
        if match:
            env_key = match.group(1)
            # Find which JS key this env_key corresponds to
            js_key = next((k for k, v in mapping.items() if v == env_key), None)
            if js_key and js_key in config:
                updated_lines.append(f"{env_key}={config[js_key]}\n")
                found_keys.add(env_key)
                continue
        updated_lines.append(line)

    # If some keys were not found, we might want to append them, but the user requested "adds it to the accepted format"
    # and the .env already has these keys. Let's just update existing ones for now.

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(updated_lines)
    print(f"Updated {file_path}")

def parse_config(js_code):
    config = {}
    # Use regex to find key: "value" or key: 'value'
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
    approval_env = os.path.abspath(os.path.join(base_dir, "..", "SBA Web Approval", ".env"))

    print("\nUpdating environment variables...")
    update_env(web_pro_env, config)
    update_env(approval_env, config)
    print("\nDone!")

if __name__ == "__main__":
    main()
