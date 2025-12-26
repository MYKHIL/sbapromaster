#!/usr/bin/env python3
"""
Local Test Server for License Management Portal
Serves the license portal HTML file and provides CORS headers for Firebase access
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path

# Configuration
PORT = 8000
DIRECTORY = Path("d:/Projects/SBA Web Approval")  # Points to SBA Web Approval folder

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP Request Handler with CORS headers"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)
    
    def end_headers(self):
        """Add CORS headers to all responses"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()
    
    def do_OPTIONS(self):
        """Handle preflight requests"""
        self.send_response(200)
        self.end_headers()
    
    def log_message(self, format, *args):
        """Custom log format"""
        print(f"[{self.log_date_time_string()}] {format % args}")

def main():
    """Start the local development server"""
    
    # Check if directory exists
    if not DIRECTORY.exists():
        print(f"❌ Error: Directory not found: {DIRECTORY}")
        print(f"Creating directory...")
        DIRECTORY.mkdir(parents=True, exist_ok=True)
    
    # Check if HTML file exists
    html_file = DIRECTORY / "license-portal.html"
    if not html_file.exists():
        print(f"❌ Error: license-portal.html not found in {DIRECTORY}")
        print(f"Please ensure the file exists before running the server.")
        sys.exit(1)
    
    print("=" * 70)
    print("🚀 License Management Portal - Local Test Server")
    print("=" * 70)
    print()
    print(f"📂 Serving directory: {DIRECTORY}")
    print(f"🌐 Server running at: http://localhost:{PORT}")
    print(f"📄 Portal URL: http://localhost:{PORT}/license-portal.html")
    print()
    print("⚠️  SECURITY WARNING:")
    print("   This server is for LOCAL TESTING ONLY!")
    print("   Do NOT use in production - it has no authentication.")
    print()
    print("Press Ctrl+C to stop the server")
    print("=" * 70)
    print()
    
    try:
        with socketserver.TCPServer(("", PORT), CORSHTTPRequestHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped")
        sys.exit(0)
    except OSError as e:
        if e.errno == 98 or e.errno == 48:  # Address already in use
            print(f"\n❌ Error: Port {PORT} is already in use")
            print(f"Try a different port or stop the process using port {PORT}")
            sys.exit(1)
        else:
            raise

if __name__ == "__main__":
    main()
