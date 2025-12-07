import os
import subprocess
import sys

def main():
    # Define the path to the WPF project directory relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.join(script_dir, "SBA Pro Master - WPF", "SBAProMaster")
    
    if not os.path.exists(project_dir):
        print(f"Error: Project directory not found at {project_dir}")
        return

    print(f"Starting WPF Application from {project_dir}...")
    
    try:
        # Run dotnet run in the project directory
        # check=False allows us to handle the error cleanly or ignore exit codes if needed
        subprocess.run(["dotnet", "run"], cwd=project_dir, check=False)
    except FileNotFoundError:
        print("Error: 'dotnet' command not found. Please ensure .NET SDK is installed and in your PATH.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()
