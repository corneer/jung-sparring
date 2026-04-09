#!/bin/bash
export PATH="/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")"
exec /opt/homebrew/bin/npm run dev --workspace=@jung/api
