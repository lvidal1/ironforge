#!/bin/bash
# Fix for OpenClaw duplicate messages bug
# Adds chatStreamSegments=[] clearing in Ex() before Tx() is called
# This prevents stream segments from being rendered alongside history messages

BUNDLE="/app/dist/control-ui/assets/index-tfOsi8ru.js"

if [ -f "$BUNDLE" ]; then
    if grep -q 'e.chatStreamSegments=\[\],Tx(e),' "$BUNDLE"; then
        echo "✓ Patch already applied"
    else
        echo "Applying duplicate messages fix..."
        sed -i 's/chatThinkingLevel=a\.thinkingLevel??null,Tx(e),/chatThinkingLevel=a.thinkingLevel??null,e.chatStreamSegments=[],Tx(e),/' "$BUNDLE"
        echo "✓ Patch applied"
    fi
else
    echo "✗ Bundle not found at $BUNDLE"
    exit 1
fi
