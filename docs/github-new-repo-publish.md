# Publish as a New GitHub Repository

I could not push directly from this environment because GitHub CLI/auth credentials are not available.

## What I checked
- `gh` authentication status (CLI not authenticated/available).
- No `GITHUB_TOKEN` / `GH_TOKEN` in environment.

## One-time commands to run locally

```bash
# from this repo root

git checkout work

# create a new repo on GitHub (replace YOUR_ORG_OR_USER and NEW_REPO_NAME)
git remote remove origin 2>/dev/null || true
git remote add origin git@github.com:YOUR_ORG_OR_USER/NEW_REPO_NAME.git

# push current branch and set upstream
git push -u origin work

# optionally push as main
git branch -M main
git push -u origin main
```

## If using HTTPS instead of SSH

```bash
git remote set-url origin https://github.com/YOUR_ORG_OR_USER/NEW_REPO_NAME.git
git push -u origin main
```

## Optional: create repo quickly via GitHub CLI

```bash
# if gh is installed and authenticated
gh repo create YOUR_ORG_OR_USER/NEW_REPO_NAME --private --source=. --remote=origin --push
```
