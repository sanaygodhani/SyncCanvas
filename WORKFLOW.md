<!-- managed:linked-repos -->
## Linked Repositories
- sanaygodhani/SyncCanvas
<!-- /managed:linked-repos -->

# SyncCanvas Code Workflow

## Branch Strategy
- `main` — production-ready, deployable code
- Feature branches off `main`: `<name>/<feature-name>` (e.g. `backend/sync-engine`, `frontend/canvas-ui`)
- PRs merge into `main` via squash

## Code Review Process
1. Engineer pushes code to a feature branch
2. Engineer creates a Pull Request to `main`
3. Lead reviews the PR (code quality, correctness, protocol alignment)
4. Lead merges with `gh pr merge --squash`

## Testing
- Backend: Node.js unit tests (basic coverage for sync engine and CRDT logic)
- Frontend: Manual testing in browser is fine for MVP
- Test server: `node src/index.js` from server dir
- Test client: open `client/index.html` in browser

## Running Locally
```bash
# Terminal 1 — Start server
cd server && node src/index.js

# Terminal 2 — Start static file server for client
cd client && npx serve . -p 8080

# Open http://localhost:8080 in 2+ browser tabs
```