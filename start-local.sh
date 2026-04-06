#!/bin/bash

# Terminal 1: Start CORD node with proper port mapping for macOS
# This creates a local CORD blockchain node accessible at ws://127.0.0.1:9944
docker run -d -p 9944:9944 -p 9933:9933 --name cord-node dhiway/cord:develop --dev --rpc-external

echo "⏳ Waiting for node to start..."
sleep 5
echo "✅ CORD node should be running on ws://127.0.0.1:9944"
echo "📊 Block explorer: https://apps.cord.network/?rpc=ws%3A%2F%2F127.0.0.1%3A9944#/explorer"
echo ""
echo "Terminal 2: Run demo (in another terminal):"
echo "  cd /Users/amitbhat/dhiway-test-projects/cord-demo-scripts"
echo "  yarn demo-statement"

# Keep container running
sleep infinity
