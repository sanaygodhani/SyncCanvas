# SyncCanvas — Code Workflow & Auto-Push Policy

## Core Rule
**Every file creation or modification MUST be committed and pushed to GitHub immediately.**

No work is complete until it's pushed. The remote URL uses a classic GitHub token for auth.

## Auto-Push Commands

### Quick push (after any change):
```bash
cd /home/team/shared/repo
git add -A
git commit -m "scope: description of change"
git push origin main
```

### For new feature work:
```bash
git checkout -b feat/feature-name
# ... make changes ...
git add -A && git commit -m "feat: description" && git push origin feat/feature-name
```

## Remote Setup (already configured)
```
origin  https://<token>@github.com/sanaygodhani/SyncCanvas.git (fetch)
origin  https://<token>@github.com/sanaygodhani/SyncCanvas.git (push)
```

## Branch Strategy
- `main` — production-ready code (push goes here by default)
- `feat/*` — feature branches (create PRs)
- The plan document lives at `IMPLEMENTATION_PLAN.md` in repo root

## Repo Path
The local clone is at: `/home/team/shared/repo/`

All project code lives under `/home/team/shared/project/` and should be synced to the repo before committing.

## Sync Steps (copy project → repo → push)
```bash
# 1. Copy updated project files into repo
cp -r /home/team/shared/project/server/* /home/team/shared/repo/server/
cp -r /home/team/shared/project/client/* /home/team/shared/repo/client/

# 2. Add architecture docs
cp /home/team/shared/architecture/*.md /home/team/shared/repo/

# 3. Commit and push
cd /home/team/shared/repo
git add -A
git commit -m "desc: what changed"
git push origin main
```