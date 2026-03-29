"""
config.py
---------
Shared configuration loaded from environment variables.
Imported by server.py and all handler modules.
"""

import json
import os

def load_tools():
    file_path = 'tools.json'
    data = None

    with open(file_path, 'r', encoding='utf-8') as file:
        data: list[dict] = json.load(file)

    return data

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
MCP_PORT    = int(os.getenv("MCP_PORT", "8081"))
TOOLS       = load_tools()

