#!/usr/bin/env python3
import http.server
import socketserver
import os
import json
import urllib.request
import urllib.error
import traceback

PORT = 8080

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add PWA headers
        self.send_header('Service-Worker-Allowed', '/')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        super().end_headers()

    def do_POST(self):
        print(f"\n[POST] Request for {self.path}")
        if self.path.startswith('/api/auth/'):
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length == 0:
                    self.send_error_response(400, "No data provided")
                    return

                post_data = self.rfile.read(content_length)
                print(f"  Data received: {post_data.decode()[:100]}...")
                
                data = json.loads(post_data)
                
                # Map frontend fields to backend fields
                backend_data = {
                    "fname": data.get("firstName", data.get("fname", "")),
                    "lname": data.get("lastName", data.get("lname", "")),
                    "email": data.get("email", ""),
                    "phone": data.get("phone", ""),
                    "password": data.get("password", ""),
                    "role_type": data.get("role_type", "passenger"),
                    "gender": data.get("gender", "other"),
                    "is_active": True
                }
                
                # Determine backend endpoint
                if self.path.endswith('/register'):
                    backend_url = "http://localhost:8810/users/register/"
                elif self.path.endswith('/login'):
                    backend_url = "http://localhost:8810/users/login"
                    backend_data = {
                        "email": data.get("email", ""),
                        "password": data.get("password", "")
                    }
                else:
                    self.send_response(404)
                    self.end_headers()
                    return

                print(f"  Forwarding to backend: {backend_url}")
                
                # Forward request to backend
                req = urllib.request.Request(
                    backend_url, 
                    data=json.dumps(backend_data).encode(),
                    headers={'Content-Type': 'application/json'},
                    method='POST'
                )
                
                try:
                    with urllib.request.urlopen(req) as f:
                        backend_response = f.read().decode()
                        print(f"  Backend success")
                        backend_data = json.loads(backend_response)
                        
                        response = {
                            "success": True,
                            "user": backend_data,
                            "token": "backend-auth-token"
                        }
                        
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps(response).encode())
                        
                except urllib.error.HTTPError as e:
                    error_msg = e.read().decode()
                    print(f"  Backend error {e.code}: {error_msg}")
                    self.send_response(e.code)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(error_msg.encode())
                except urllib.error.URLError as e:
                    print(f"  Connection error: {e.reason}")
                    self.send_error_response(503, f"Backend connection failed: {e.reason}")
                    
            except Exception as e:
                print(f"  Unexpected error: {e}")
                traceback.print_exc()
                self.send_error_response(500, str(e))
            return
        
        # Fallback for other POST requests
        self.send_response(501)
        self.end_headers()

    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"success": False, "error": message}).encode())

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = ThreadingHTTPServer(("", PORT), MyHTTPRequestHandler)
    print(f"Serving at http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        server.server_close()
