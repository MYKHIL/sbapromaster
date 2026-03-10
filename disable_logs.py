import os
import re

def disable_console_logs():
    project_root = os.path.dirname(os.path.abspath(__file__))
    # Only target source directories to avoid touching node_modules or build folders
    target_dirs = ['components', 'context', 'hooks', 'services', 'utils', 'pages', 'src']
    
    # This Regex matches console.log, console.info, console.debug, console.warn.
    # Excludes console.error to keep critical error reporting active.
    # - Negative lookbehind: (?<!// )(?<!//) ignores lines that are already commented.
    # - Negative lookahead: (?!\s*=) ignores assignments like `console.log = ` to prevent syntax errors.
    # We replace 'console.log' with '(() => {})', which is a safe no-op.
    # E.g: `console.log("val")` becomes `(() => {})("val")` which compiles flawlessly.
    pattern = re.compile(r'(?<!// )(?<!//)console\.(log|info|debug|warn)\b(?!\s*=)')

    total_disabled = 0
    modified_files = 0

    print("🔍 Scanning project for console logs...\n")

    for target in target_dirs:
        target_path = os.path.join(project_root, target)
        if not os.path.exists(target_path):
            continue
            
        for root, dirs, files in os.walk(target_path):
            for file in files:
                if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
                    filepath = os.path.join(root, file)
                    
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                    if 'console.' not in content:
                        continue
                        
                    new_content, num_subs = pattern.subn(r'(() => {})', content)
                    
                    if num_subs > 0:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        total_disabled += num_subs
                        modified_files += 1
                        print(f"✔️ Disabled {num_subs} logs in {os.path.relpath(filepath, project_root)}")
                        
    print(f"\n✅ Successfully disabled {total_disabled} console logs across {modified_files} files.")
    print("You can run this script anytime before a production build to cleanly disable debug logging.")

if __name__ == '__main__':
    disable_console_logs()
