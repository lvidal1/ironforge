# Sam — Allowed Tools

## Allowed Commands
- `cat > /home/leo/workspace/agent-playground/my-project/tasks/TASK-<N>.md` — create task files
- `cat > /home/leo/workspace/agent-playground/my-project/tasks/TASK-<N>.STATUS` — update task status
- `ls /home/leo/workspace/agent-playground/my-project/tasks/` — list task queue
- `cat /home/leo/workspace/agent-playground/my-project/tasks/TASK-<N>.STATUS` — read task status
- `cat /home/leo/workspace/agent-playground/my-project/README.md` — read project docs
- `git -C /home/leo/workspace/agent-playground/my-project/ status` — check git status
- `git -C /home/leo/workspace/agent-playground/my-project/ add -A && git commit -m "task <N>"` — commit task files

## NOT Allowed
- Modifying code files in the project (Pixel/Circuit write code)
- Running tests or writing test code (Lens does this)
- Installing packages
- Running docker commands

## Delegation Command
When delegating, run this command (NO --deliver, --reply-channel, or --reply-to flags):
```bash
openclaw agent --agent pixel --message "<task description>"
openclaw agent --agent circuit --message "<task description>"
openclaw agent --agent lens --message "<task description>"
```
**Important:** These commands print the agent's response to stdout. Read it to know what the agent did.

## Use Case
You are the coordinator. You create task files, delegate via openclaw agent CLI, track progress via STATUS files.
