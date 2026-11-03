#!/usr/bin/env python3
"""
dev.sh — hot reload dev server for my-engine.
Usage: ./scripts/dev.sh [port]
Default port: 8080

Features:
- Serves static files from project root
- SSE endpoint /__reload for hot reload
- Polls file mtimes every 300ms
- Sends reload event when files change
"""
import http.server
import socketserver
import os
import sys
import time
import json
import threading
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
ROOT = Path(__file__).parent.parent.resolve()

# File extensions to watch
WATCH_EXTS = {'.js', '.html', '.json5', '.css'}
WATCH_DIRS = ['engine', 'config', 'examples', 'templates', 'prototypes']

# Global state
clients = []
last_mtimes = {}
server_running = True

def get_watched_files():
    """Get all files to watch with their mtimes."""
    files = {}
    for dir_name in WATCH_DIRS:
        dir_path = ROOT / dir_name
        if dir_path.exists():
            for ext in WATCH_EXTS:
                for f in dir_path.rglob(f'*{ext}'):
                    try:
                        files[str(f)] = f.stat().st_mtime
                    except:
                        pass
    return files

def check_for_changes():
    """Check if any watched files have changed."""
    global last_mtimes
    current = get_watched_files()
    
    # Check for new or modified files
    changed = False
    for path, mtime in current.items():
        if path not in last_mtimes or last_mtimes[path] < mtime:
            changed = True
            break
    
    # Check for deleted files
    for path in last_mtimes:
        if path not in current:
            changed = True
            break
    
    last_mtimes = current
    return changed

def poll_files():
    """Poll for file changes and notify clients."""
    global last_mtimes
    last_mtimes = get_watched_files()
    
    while server_running:
        time.sleep(0.3)  # 300ms poll interval
        if check_for_changes():
            # Notify all clients
            for client in clients[:]:
                try:
                    client.write(b'data: reload\n\n')
                    client.flush()
                except:
                    clients.remove(client)

class DevHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    
    def do_HEAD(self):
        if self.path == '/__reload/ping':
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
        else:
            super().do_HEAD()
    
    def do_GET(self):
        if self.path == '/__reload':
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.end_headers()
            
            # Add to clients list
            clients.append(self.wfile)
            
            # Keep connection alive
            try:
                while server_running:
                    time.sleep(1)
            except:
                pass
            finally:
                if self.wfile in clients:
                    clients.remove(self.wfile)
        else:
            super().do_GET()
    
    def log_message(self, format, *args):
        # Quieter logging
        if '/__reload' not in self.path:
            super().log_message(format, *args)

def main():
    print(f'🚀 Dev server starting on http://localhost:{PORT}')
    print(f'📁 Serving from: {ROOT}')
    print(f'👀 Watching: {", ".join(WATCH_DIRS)}')
    print(f'🔄 Hot reload: edit any .js/.html/.json5/.css file')
    print()
    
    # Start file polling thread
    poll_thread = threading.Thread(target=poll_files, daemon=True)
    poll_thread.start()
    
    # Start HTTP server
    with socketserver.TCPServer(("", PORT), DevHandler) as httpd:
        httpd.allow_reuse_address = True
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n🛑 Shutting down...')
            global server_running
            server_running = False

if __name__ == '__main__':
    main()
