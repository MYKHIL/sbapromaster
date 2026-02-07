#!/usr/bin/env python3
"""
Firebase Configuration Manager
Automates adding new Firebase configurations to constants.ts
"""

import re
import sys

def parse_firebase_config(config_text):
    """Parse Firebase configuration from JavaScript code."""
    config = {}
    
    # Extract values using regex
    patterns = {
        'apiKey': r'apiKey:\s*["\']([^"\']+)["\']',
        'authDomain': r'authDomain:\s*["\']([^"\']+)["\']',
        'projectId': r'projectId:\s*["\']([^"\']+)["\']',
        'storageBucket': r'storageBucket:\s*["\']([^"\']+)["\']',
        'messagingSenderId': r'messagingSenderId:\s*["\']([^"\']+)["\']',
        'appId': r'appId:\s*["\']([^"\']+)["\']',
        'measurementId': r'measurementId:\s*["\']([^"\']+)["\']'
    }
    
    for key, pattern in patterns.items():
        match = re.search(pattern, config_text)
        if match:
            config[key] = match.group(1)
        else:
            print(f"Warning: Could not find {key} in configuration")
    
    return config

def get_next_index(constants_content):
    """Find the next available index in FIREBASE_CONFIGS."""
    # Find all existing indices
    indices = re.findall(r'^\s*(\d+):\s*\{', constants_content, re.MULTILINE)
    if not indices:
        return 1
    return max(int(idx) for idx in indices) + 1

def generate_config_entry(index, config, is_reserved, label):
    """Generate TypeScript configuration entry."""
    reserved_str = "true" if is_reserved else "false"
    pool_type = "Reserved" if is_reserved else "Public Pool"
    
    entry = f"""  // INDEX {index}: {label} ({pool_type})
  {index}: {{
    apiKey: "{config['apiKey']}",
    authDomain: "{config['authDomain']}",
    projectId: "{config['projectId']}",
    storageBucket: "{config['storageBucket']}",
    messagingSenderId: "{config['messagingSenderId']}",
    appId: "{config['appId']}",
    measurementId: "{config['measurementId']}",
    isReserved: {reserved_str},
    label: '{label}'
  }}"""
    
    return entry

def add_config_to_file(constants_path, new_config_entry):
    """Add new configuration to constants.ts file."""
    try:
        with open(constants_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find the closing brace of FIREBASE_CONFIGS
        match = re.search(r'(export const FIREBASE_CONFIGS:.*?\{)(.*?)(^\};)', content, re.MULTILINE | re.DOTALL)
        
        if not match:
            print("Error: Could not find FIREBASE_CONFIGS in constants.ts")
            return False
        
        prefix = match.group(1)
        configs = match.group(2)
        suffix = match.group(3)
        
        # Add new config (with comma before closing brace)
        new_content = prefix + configs.rstrip() + ",\n" + new_config_entry + "\n" + suffix
        
        # Replace in original content
        updated_content = content.replace(match.group(0), new_content)
        
        # Write back
        with open(constants_path, 'w', encoding='utf-8') as f:
            f.write(updated_content)
        
        print(f"\n✅ Successfully added configuration to {constants_path}")
        return True
        
    except FileNotFoundError:
        print(f"Error: File not found: {constants_path}")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

def update_license_portal(portal_path, index, config):
    """Add new configuration to license-portal.html."""
    try:
        with open(portal_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Find the FIREBASE_CONFIGS object
        # Match from "const FIREBASE_CONFIGS = {" to symbols that appear at the end "};"
        pattern = r'(const FIREBASE_CONFIGS = \{)(.*?)(\};)'
        match = re.search(pattern, content, re.DOTALL)
        
        if not match:
            print(f"Warning: Could not find FIREBASE_CONFIGS in {portal_path}")
            return False
            
        prefix = match.group(1)
        configs = match.group(2)
        suffix = match.group(3)
        
        # New entry for HTML (slightly different format - no "label" or "isReserved" usually, 
        # but the portal uses standard firebase config plus authDomain etc.)
        new_entry = f"""            {index}: {{
                apiKey: "{config['apiKey']}",
                authDomain: "{config['authDomain']}",
                projectId: "{config['projectId']}",
                storageBucket: "{config['storageBucket']}",
                messagingSenderId: "{config['messagingSenderId']}",
                appId: "{config['appId']}"
            }}"""
        
        # Add new config (with comma before closing brace)
        # Ensure we don't add duplicate indices if possible, though we trust get_next_index
        updated_configs = configs.rstrip()
        if not updated_configs.endswith(','):
            updated_configs += ","
            
        new_content = prefix + updated_configs + "\n" + new_entry + "\n        " + suffix
        
        # Replace in original content
        updated_full_content = content.replace(match.group(0), new_content)
        
        with open(portal_path, 'w', encoding='utf-8') as f:
            f.write(updated_full_content)
            
        print(f"✅ Successfully added configuration to {portal_path}")
        return True
        
    except Exception as e:
        print(f"Error updating license portal: {e}")
        return False

def main():
    print("=" * 60)
    print("Firebase Configuration Manager")
    print("=" * 60)
    print()
    
    # Get configuration from user
    print("Paste your Firebase configuration code below.")
    print("(Press Ctrl+D on Unix/Linux or Ctrl+Z on Windows when done)")
    print("-" * 60)
    
    lines = []
    try:
        while True:
            line = input()
            lines.append(line)
    except EOFError:
        pass
    
    config_text = '\n'.join(lines)
    
    # Parse configuration
    config = parse_firebase_config(config_text)
    
    if len(config) < 6:
        print("\n❌ Failed to parse all required configuration fields")
        print(f"Found: {list(config.keys())}")
        sys.exit(1)
    
    print("\n✅ Configuration parsed successfully:")
    print(f"   Project: {config.get('projectId', 'Unknown')}")
    
    # Ask if reserved or public
    print()
    while True:
        db_type = input("Is this a PUBLIC or SPECIAL (reserved) database? (public/special): ").strip().lower()
        if db_type in ['public', 'special']:
            break
        print("Please enter 'public' or 'special'")
    
    is_reserved = (db_type == 'special')
    
    # Get label
    print()
    default_label = f"Public {config['projectId'][-5:]}" if not is_reserved else "Reserved"
    label = input(f"Enter a label for this database [{default_label}]: ").strip() or default_label
    
    # Paths
    print()
    default_constants_path = "d:\\Projects\\SBA Pro Master - Web\\constants.ts"
    constants_path = input(f"Path to constants.ts [{default_constants_path}]: ").strip() or default_constants_path
    
    default_portal_path = "d:\\Projects\\SBA Web Approval\\license-portal.html"
    portal_path = input(f"Path to license-portal.html [{default_portal_path}]: ").strip() or default_portal_path
    
    # Read file to get next index
    try:
        with open(constants_path, 'r', encoding='utf-8') as f:
            constants_content = f.read()
    except FileNotFoundError:
        print(f"\n❌ File not found: {constants_path}")
        sys.exit(1)
    
    next_index = get_next_index(constants_content)
    
    # Generate and add configuration
    print(f"\n📝 Generating configuration entry for index {next_index}...")
    config_entry = generate_config_entry(next_index, config, is_reserved, label)
    
    print("\nPreview (constants.ts):")
    print("-" * 60)
    print(config_entry)
    print("-" * 60)
    
    confirm = input("\nAdd this configuration to constants.ts and license-portal.html? (yes/no): ").strip().lower()
    if confirm == 'yes':
        success = True
        if not add_config_to_file(constants_path, config_entry):
            success = False
            
        if not update_license_portal(portal_path, next_index, config):
            success = False
            
        if success:
            print("\n🎉 Configuration added successfully to BOTH files!")
            print(f"   Index: {next_index}")
            print(f"   Label: {label}")
        else:
            print("\n⚠️ Operation completed with warnings/errors.")
            sys.exit(1)
    else:
        print("\n❌ Operation cancelled")

if __name__ == "__main__":
    main()
