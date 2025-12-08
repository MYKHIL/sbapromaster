import os
import subprocess

def main():
    project_dir = r"D:\Projects\SBA Pro Master - WPF\SBAProMaster"

    if not os.path.exists(project_dir):
        print(f"Error: Project directory not found at {project_dir}")
        return

    print(f"Starting WPF Application from {project_dir}...")
    
    try:
        subprocess.run(["dotnet", "run"], cwd=project_dir, check=False)
    except FileNotFoundError:
        print("Error: 'dotnet' command not found. Please install .NET SDK.")
    except Exception as e:
        print(f"Unexpected error: {e}")

if __name__ == "__main__":
    main()
