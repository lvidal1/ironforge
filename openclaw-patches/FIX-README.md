# OpenClaw Duplicate Message Bug Fix

## Root Cause
The duplicate message bug occurred when:

1. User sends a message
2. Assistant starts streaming → text chunks accumulate in `chatStreamSegments`
3. Streaming completes → assistant message is finalized
4. `Ex()` (history loader) reloads chat history from the backend
5. **BUG**: `Tx()` → `__()` clears `chatStreamSegments`, but only if ALL guard conditions pass:
   ```javascript
   t.toolStreamById instanceof Map &&
   Array.isArray(t.toolStreamOrder) &&
   Array.isArray(t.chatToolMessages) &&
   Array.isArray(t.chatStreamSegments)
   ```
   If any condition fails (e.g., `toolStreamById` was modified), `__()` is silently skipped.
6. **Result**: `chatStreamSegments` still contains streaming data, while `chatMessages` also contains the completed history message
7. `gj()` (renderer) renders BOTH the stream segments AND the history messages → DUPLICATES

## The Fix
Added `e.chatStreamSegments=[]` directly in `Ex()` before `Tx(e)` is called:

**Before:**
```javascript
e.chatMessages = xx(history, current);
e.currentSessionId = ...;
e.chatThinkingLevel = ...;
Tx(e);  // may silently skip if guard conditions fail
e.chatStream = null;
e.chatStreamStartedAt = null;
```

**After:**
```javascript
e.chatMessages = xx(history, current);
e.currentSessionId = ...;
e.chatThinkingLevel = ...;
e.chatStreamSegments = [];  // <-- NEW: always cleared
Tx(e);  // still clears other streaming state
e.chatStream = null;
e.chatStreamStartedAt = null;
```

## Persistence
The patch is saved in:
- `/home/leo/workspace/command-center/openclaw-patches/fix-duplicates.sh` - one-liner to apply
- `/home/leo/workspace/command-center/openclaw-patches/index-patched.js` - full patched bundle

To re-apply after container rebuild:
```bash
bash /home/leo/workspace/command-center/openclaw-patches/fix-duplicates.sh
docker compose restart openclaw
```

## Notes
- The `xx()` dedup function was NOT the root cause - it works correctly
- The userscript workaround (`openclaw-dedup-workaround.user.js`) is now a backup safety net
- Beta version 2026.5.20-beta.1 has the same bug (unfixed upstream)
