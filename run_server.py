#!/usr/bin/env python3
"""
start_server.py

Kills any process listening on the Vite default port (5173), starts `npm run dev`,
streams the server logs to stdout, waits until the server responds, and opens the
default browser to the server URL.

Designed for Windows (PowerShell) but should work on other platforms with minor
adjustments.
"""

import subprocess
import sys
import time
import re
import threading
import urllib.request
import urllib.parse
import webbrowser
import os
import signal
import shutil

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 5173
HOST = 'localhost'
URL = f'http://{HOST}:{PORT}/'

# ------------------------------------------------------------------------------
# GLOBAL DEBUG CONFIG
# ------------------------------------------------------------------------------
# Default to False, but will be overridden by user input
# ------------------------------------------------------------------------------

def start_firestore_emulator():
    """Starts the Firestore emulator in a separate process."""
    print("Starting Firestore Emulator...")
    cwd = PROJECT_ROOT
    # Force the emulator to use the specific project ID and the DEBUG config (open rules)
    # This prevents "Demo" project mode and ensures UI matches App.
    cmd = ["npx", "firebase", "emulators:start", "--only", "firestore", "--project", "sba-pro-master-40f08", "--config", "firebase.debug.json"]
    
    # Check if npx exists (should be there if npm is there)
    if os.name == 'nt':
        cmd = ["npx.cmd", "firebase", "emulators:start", "--only", "firestore", "--project", "sba-pro-master-40f08", "--config", "firebase.debug.json"]

    try:
        # We start it as a background process.
        # We pipe stdout/stderr to the console so the user can see what's happening.
        print(f"Executing: {' '.join(cmd)}")
        proc = subprocess.Popen(
            cmd, 
            cwd=cwd, 
            shell=True,
            stdout=sys.stdout, # Inherit stdout to show logs
            stderr=sys.stderr  # Inherit stderr to show errors
        )
        return proc
    except Exception as e:
        print(f"Failed to start emulator: {e}")
        return None


def ensure_firebase_config():
    """Ensures firebase.json and .firebaserc exist to prevent init warnings."""
    config_path = os.path.join(PROJECT_ROOT, 'firebase.json')
    rc_path = os.path.join(PROJECT_ROOT, '.firebaserc')

    # 1. Ensure firebase.json
    if not os.path.exists(config_path):
        print("Creating firebase.json for emulator configuration...")
        with open(config_path, 'w') as f:
            f.write('''{
    "emulators": {
        "firestore": {
            "port": 8080
        },
        "ui": {
            "enabled": true,
            "port": 4000
        },
        "singleProjectMode": true
    }
}''')

    # 2. Ensure .firebaserc
    if not os.path.exists(rc_path):
        print("Creating .firebaserc for project alias...")
        with open(rc_path, 'w') as f:
            f.write('''{
  "projects": {
    "default": "sba-pro-master-40f08"
  }
}''')



def find_pids_on_port(port):
    """Return a set of PIDs listening on the given TCP port (Windows `netstat -ano`)."""
    try:
        output = subprocess.check_output(['netstat', '-ano'], stderr=subprocess.DEVNULL, text=True)
    except Exception:
        return set()

    pids = set()
    # Look for lines containing :{port} and "LISTENING" or "ESTABLISHED"
    # Example line (Windows): TCP    0.0.0.0:5173         0.0.0.0:0              LISTENING       1234
    for line in output.splitlines():
        if f':{port} ' in line or f':{port}\r' in line or line.strip().endswith(f':{port}'):
            parts = re.split(r"\s+", line.strip())
            if parts:
                pid = parts[-1]
                if pid.isdigit():
                    pids.add(int(pid))
    return pids


def kill_pids(pids):
    for pid in pids:
        try:
            print(f'Killing PID {pid}...')
            subprocess.check_call(['taskkill', '/PID', str(pid), '/F'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            print(f'Failed to kill PID {pid} (may already be gone).')


def stream_process_output(proc, url_event, detected_url_container):
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    try:
        for line in proc.stdout:
            try:
                sys.stdout.write(line)
                sys.stdout.flush()
            except Exception:
                pass
            # Attempt to detect a URL in the Vite output, e.g.:
            # "  Local:   http://localhost:3000/"
            if not url_event.is_set():
                clean_line = ansi_escape.sub('', line)
                # Capture host (including bracketed IPv6) and optional port.
                m = re.search(r"(https?://(\[[^\]]+\]|[^:/\s]+)(?::(\d+))?)", clean_line)
                if m:
                    detected_raw = m.group(1).strip()
                    host_part = m.group(2)
                    port_part = m.group(3)
                    scheme = 'http'
                    try:
                        if detected_raw.startswith('http'):
                            scheme = urllib.parse.urlparse(detected_raw).scheme or 'http'
                    except Exception:
                        scheme = 'http'

                    # Normalize host display: ensure bracketed for IPv6
                    host_display = host_part
                    if host_display.startswith('[') and host_display.endswith(']'):
                        host_unbracketed = host_display[1:-1]
                        host_display = f'[{host_unbracketed}]'
                    else:
                        # if it contains a colon (likely IPv6) but not bracketed, bracket it
                        if ':' in host_display and not host_display.startswith('['):
                            host_display = f'[{host_display}]'

                    if port_part:
                        normalized = f"{scheme}://{host_display}:{int(port_part)}/"
                    else:
                        normalized = f"{scheme}://{host_display}/"

                    # Guarantee exactly one trailing slash
                    normalized = normalized.rstrip('/') + '/'

                    # Append to candidate list
                    try:
                        detected_url_container[1].append(normalized)
                    except Exception:
                        detected_url_container[1] = [normalized]

                    # If this candidate includes an explicit port, prefer it and set the event
                    if port_part:
                        detected_url_container[0] = normalized
                        url_event.set()
    except Exception:
        pass


def socket_check(host, port, timeout=2.0):
    import socket
    try:
        # Resolve host to addresses (handles localhost -> IPv4/IPv6)
        host_sock = host
        if host_sock.startswith('[') and host_sock.endswith(']'):
            host_sock = host_sock[1:-1]
        addrs = socket.getaddrinfo(host_sock, port, proto=socket.IPPROTO_TCP)
        for family, socktype, proto, canonname, sockaddr in addrs:
            try:
                s = socket.socket(family, socktype, proto)
                s.settimeout(timeout)
                s.connect(sockaddr)
                s.close()
                return True
            except Exception:
                try:
                    s.close()
                except Exception:
                    pass
        return False
    except Exception:
        return False


def wait_for_server(url, timeout=30.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status < 400:
                    return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def main():
    print('Start script running in:', PROJECT_ROOT)

    # Ask user for mode
    print("\n----------------------------------------------------------------")
    print("SELECT RUN MODE:")
    print("1) DEBUG MODE   (Firestore Emulator - Safe for testing)")
    print("2) PUBLISH MODE (Real Firestore - Production Data)")
    print("----------------------------------------------------------------")
    choice = input("Enter 1 or 2 [Default: 2]: ").strip()
    
    DEBUG_MODE = (choice == '1')

    emulator_proc = None

    # Step 0: Check for Debug Mode and Emulators
    if DEBUG_MODE:
        ensure_firebase_config()

        print("----------------------------------------------------------------")
        print("⚠️  DEBUG MODE ACTIVE - USING FIRESTORE EMULATOR ⚠️")
        print("----------------------------------------------------------------")
        
        # Set environment variable for Vite to pick up
        os.environ['VITE_USE_EMULATOR'] = 'true'
        
        # Check if emulator port (8080) is already in use
        emulator_ready = False
        if socket_check('localhost', 8080):
             print(f"Port 8080 is already active. Assuming Emulator is running.")
             emulator_ready = True
        else:
            print("Port 8080 is free. Launching Firestore Emulator...")
            emulator_proc = start_firestore_emulator()
            
            # Wait for Emulator to be ready (Port 8080 for Firestore, 4000 for UI)
            print("Waiting for Firestore Emulator to initialize...")
            start_wait = time.time()
            while time.time() - start_wait < 60: # Wait up to 60 seconds
                if socket_check('localhost', 8080) and socket_check('localhost', 4000):
                    print("✅ Firestore Emulator is UP and RUNNING!")
                    emulator_ready = True
                    break
                time.sleep(1)
            
            if not emulator_ready:
                print("❌ Timed out waiting for Emulator. Continuing anyway, but things might break.")

        if emulator_ready:
            print("Opening Firestore Emulator UI...")
            try:
                # Open in a background thread or just open it
                webbrowser.open("http://localhost:4000")
            except Exception as e:
                print(f"Failed to open Emulator UI: {e}")
            
    else:
        print("----------------------------------------------------------------")
        print("🚀 PUBLISH/LIVE MODE - CONNECTING TO REAL FIRESTORE 🚀")
        print("----------------------------------------------------------------")
        if 'VITE_USE_EMULATOR' in os.environ:
            del os.environ['VITE_USE_EMULATOR']


    # Step 1: find & kill existing processes on ports 5173-5180
    # We check a range because Vite might have incremented the port if 5173 was busy.
    ports_to_check = range(3000, 3010)
    all_pids = set()
    for p in ports_to_check:
        found = find_pids_on_port(p)
        if found:
            print(f'Found process(es) on port {p}: {found}')
            all_pids.update(found)
    
    if all_pids:
        print(f'Killing {len(all_pids)} process(es) on ports 5173-5180...')
        kill_pids(all_pids)
        # Give them a moment to die
        time.sleep(1)
    else:
        print(f'No processes found on ports 5173-5180.')

    # Step 2: start dev server
    # Try to locate an npm executable on Windows (`npm` or `npm.cmd`) or fall back
    # to running the command through the shell. This avoids FileNotFoundError on
    # Windows when `npm` is not directly discoverable by subprocess.
    npm_exec = shutil.which('npm') or shutil.which('npm.cmd') or shutil.which('npm.exe')
    if npm_exec:
        npm_cmd = [npm_exec, 'run', 'dev']
        use_shell = False
    else:
        # Fallback: run as a shell command which will use PATH and association.
        npm_cmd = 'npm run dev'
        use_shell = True

    # Ensure local dependencies are installed (look for local `vite` binary). If
    # not found, run `npm install` automatically so `npm run dev` that references
    # the local `vite` binary will succeed.
    local_vite = os.path.join(PROJECT_ROOT, 'node_modules', '.bin', 'vite')
    local_vite_cmd = local_vite + ('.cmd' if os.name == 'nt' else '')
    if not (os.path.exists(local_vite) or os.path.exists(local_vite_cmd) or shutil.which('vite')):
        print('Local `vite` binary not found. Running `npm install` to install dependencies...')
        try:
            if npm_exec:
                install_cmd = [npm_exec, 'install']
                subprocess.check_call(install_cmd, cwd=PROJECT_ROOT, shell=False)
            else:
                subprocess.check_call('npm install', cwd=PROJECT_ROOT, shell=True)
        except subprocess.CalledProcessError as e:
            print('`npm install` failed with exit code', e.returncode)
            print('Please run `npm install` manually and then re-run this script.')
            sys.exit(1)
        except Exception as e:
            print('`npm install` failed:', e)
            print('Please run `npm install` manually and then re-run this script.')
            sys.exit(1)

    try:
        # Pass current environment (including VITE_USE_EMULATOR)
        if isinstance(npm_cmd, list):
            print('Starting dev server:', ' '.join(npm_cmd))
            proc = subprocess.Popen(npm_cmd, cwd=PROJECT_ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace', shell=False, env=os.environ)
        else:
            print('Starting dev server (shell):', npm_cmd)
            proc = subprocess.Popen(npm_cmd, cwd=PROJECT_ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace', shell=True, env=os.environ)
    except FileNotFoundError:
        print('Error: `npm` not found. Make sure Node.js and npm are installed and available in your PATH.')
        print('You can download Node.js from https://nodejs.org/')
        sys.exit(1)
    except Exception as e:
        print('Failed to start dev server:', e)
        sys.exit(1)
    
    # Ensure we try to terminate subprocess on exit
    def _terminate(signum, frame):
        print('\nTerminating dev server...')
        try:
            proc.terminate()
        except Exception:
            pass
        
        if emulator_proc:
             print('Terminating emulator...')
             try:
                 emulator_proc.terminate()
             except Exception:
                 pass
        
        sys.exit(0)

    signal.signal(signal.SIGINT, _terminate)
    signal.signal(signal.SIGTERM, _terminate)

    # Stream output in background; also listen for the URL printed by Vite.
    url_event = threading.Event()
    # detected_url_container[0] = chosen url (when set)
    # detected_url_container[1] = list of candidate urls seen
    detected_url_container = [None, []]
    t = threading.Thread(target=stream_process_output, args=(proc, url_event, detected_url_container), daemon=True)
    t.start()
    # Wait for server URL announced in logs (preferred) or for the server to
    # respond on a detected/listening port. Timeout after 30 seconds.
    timeout = 30.0
    print(f'Waiting up to {int(timeout)}s for the dev server to announce a URL or respond...')

    if url_event.wait(timeout=timeout):
        url = detected_url_container[0]
        if url:
            # Confirm server responds before opening browser; try for a few seconds.
            print(f'Detected URL from logs: {url} — verifying responsiveness...')
            responsive = wait_for_server(url, timeout=12.0)
            if responsive:
                print(f'Server is up at {url} — opening browser...')
                try:
                    webbrowser.open(url)
                except Exception as e:
                    print('Failed to open browser:', e)
            else:
                # Provide diagnostic attempt: one more try with default host/port
                print(f'URL announced ({url}) but server did not respond within 12s. Attempting direct connection for diagnostics...')
                try:
                    with urllib.request.urlopen(url, timeout=3) as resp:
                        print('Server responded with status', resp.status)
                except Exception as ex:
                    print('Diagnostic request failed:', ex)
                print('Opening browser anyway (may still work in a moment)...')
                try:
                    webbrowser.open(url)
                except Exception as e:
                    print('Failed to open browser:', e)
    else:
        # Fallback: inspect netstat for the process PID to discover listening port
        try:
            pid = proc.pid
            ports = set()
            try:
                net_out = subprocess.check_output(['netstat', '-ano'], text=True)
                for line in net_out.splitlines():
                    parts = re.split(r"\s+", line.strip())
                    if len(parts) >= 5 and parts[-1].isdigit() and int(parts[-1]) == pid:
                        # parts[1] is local address like 0.0.0.0:3000 or [::]:3000
                        local = parts[1]
                        if ':' in local:
                            port_str = local.rsplit(':', 1)[-1]
                            if port_str.isdigit():
                                ports.add(int(port_str))
            except Exception:
                ports = set()

            if ports:
                chosen = sorted(ports)[0]
                detected_url = f'http://{HOST}:{chosen}/'
                if wait_for_server(detected_url, timeout=5.0):
                    print(f'Server is up at {detected_url} — opening browser...')
                    webbrowser.open(detected_url)
                else:
                    print('Detected server port but it did not respond fast enough. See logs above.')
            else:
                # Final fallback: try the default URL
                print(f'No server URL detected; trying default {URL} ...')
                if wait_for_server(URL, timeout=5.0):
                    print(f'Server is up at {URL} — opening browser...')
                    webbrowser.open(URL)
                else:
                    print('Server did not respond in time. See logs above for details.')
        except Exception as e:
            print('Error while detecting server port:', e)

    # Wait on the server process until it's terminated by user
    try:
        proc.wait()
    except KeyboardInterrupt:
        _terminate(None, None)


if __name__ == '__main__':
    main()
