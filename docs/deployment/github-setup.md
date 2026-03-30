# GitHub Repository Setup

Comprehensive guide to configuring your GitHub repository for security, CI/CD, and best practices. Follow these steps after forking or creating your EyeOnChess repository.

All navigation paths reference the current GitHub UI as of 2026.

---

## 1. Workflow Permissions

Required for the CD pipeline to push Docker images to GHCR.

**Settings → Actions → General** → scroll to bottom

1. Under **Workflow permissions**, select **Read and write permissions**
2. Click **Save**

---

## 2. Branch Ruleset

Protects the `master` branch from accidental pushes and requires CI to pass.

> GitHub now uses **Rulesets** (the modern replacement for branch protection rules). Rulesets are more flexible and support multiple rules stacking.

**Settings → Rules → Rulesets → New ruleset → New branch ruleset**

1. **Ruleset name:** `protect-master`
2. **Enforcement status:** change the dropdown from "Disabled" to **Active**
3. **Bypass list:**
   - Click **Add bypass**
   - Select **Repository admin** → click **Add Selected**
   - This allows repository admins to push directly while everyone else must use pull requests
4. **Target branches:**
   - Click **Add a target**
   - Select **Include default branch** (auto-targets `master`)
5. **Rules — enable these:**

| Rule                                             | Why                                 |
| ------------------------------------------------ | ----------------------------------- |
| **Restrict deletions**                           | Prevent accidental branch deletion  |
| **Require linear history**                       | Clean git history, no merge commits |
| **Require status checks to pass before merging** | CI must pass before merge           |
| **Block force pushes**                           | Prevent rewriting published history |

6. **Configure status checks:**
   - Type `Lint` → click the **+** button to add
   - Type `Test` → click **+**
   - Check **Require branches to be up to date before merging**
7. Click **Create**

---

## 3. Tag Ruleset

Prevents unauthorized creation of version tags that trigger the CD pipeline.

**Settings → Rules → Rulesets → New ruleset → New tag ruleset**

1. **Ruleset name:** `protect-tags`
2. **Enforcement status:** **Active**
3. **Bypass list:**
   - Click **Add bypass** → select **Repository admin** → **Add Selected**
4. **Target tags:**
   - Click **Add a target** → **Include by pattern** → type `v*`
5. **Rules — enable these:**

| Rule                   | Why                              |
| ---------------------- | -------------------------------- |
| **Restrict creations** | Only admins can create `v*` tags |
| **Restrict deletions** | Prevent tag deletion             |
| **Block force pushes** | Prevent tag rewriting            |

6. Click **Create**

---

## 4. Production Environment

Adds a manual approval gate before the CD pipeline deploys to your server.

**Settings → Environments → New environment**

1. **Name:** `production` → click **Configure environment**
2. **Deployment protection rules:**
   - Check **Required reviewers**
   - Add yourself (your GitHub username) as a reviewer
   - This means every deploy requires your explicit approval in the Actions UI
3. **Deployment branches and tags:**
   - Change from "All branches" to **Selected branches and tags**
   - Click **Add deployment branch or tag rule** → add pattern `v*`
   - This ensures only version tag pushes can trigger production deploys
4. Click **Save protection rules**

---

## 5. Repository Secrets

Required for the CD pipeline to SSH into your server.

**Settings → Secrets and variables → Actions → Secrets tab → New repository secret**

Add these three secrets:

| Secret            | Value                               | Description                              |
| ----------------- | ----------------------------------- | ---------------------------------------- |
| `SSH_HOST`        | Your VPS IP (e.g., `203.0.113.50`)  | Server to deploy to                      |
| `SSH_PORT`        | `2222` (or your SSH port)           | SSH port (defaults to 22 if not set)     |
| `SSH_USER`        | `deploy`                            | SSH username on the server               |
| `SSH_PRIVATE_KEY` | Contents of your deploy private key | Ed25519 key for SSH authentication       |
| `SITE_URL`        | `https://eye-on-chess.com`          | Main site URL (baked into Docker images) |
| `ADMIN_URL`       | `https://admin.eye-on-chess.com`    | Admin panel URL (baked into web image)   |

To generate a deploy key pair:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy_ed25519 -N "" -C "github-actions-deploy"
cat ~/.ssh/deploy_ed25519      # → paste into SSH_PRIVATE_KEY secret
cat ~/.ssh/deploy_ed25519.pub  # → add to server's authorized_keys
```

---

## 6. Code Security Features

**Settings → Code security** (under "Security" in the left sidebar)

Enable all available features:

| Feature                             | What it does                                                           | Action                         |
| ----------------------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| **Dependency graph**                | Maps all project dependencies                                          | On by default for public repos |
| **Dependabot alerts**               | Notifies you of vulnerable dependencies                                | Click **Enable**               |
| **Dependabot security updates**     | Auto-creates PRs to fix vulnerabilities                                | Click **Enable**               |
| **Secret scanning**                 | Detects accidentally committed secrets (API keys, passwords, tokens)   | On by default for public repos |
| **Push protection**                 | Blocks pushes that contain detected secrets before they reach the repo | Click **Enable**               |
| **Private vulnerability reporting** | Lets people report security issues privately through GitHub            | Click **Enable**               |
| **Code scanning (CodeQL)**          | Static analysis that finds bugs and security vulnerabilities in code   | Click **Set up** → **Default** |

---

## 7. Actions Security

**Settings → Actions → General**

1. **Actions permissions:** keep "Allow all actions and reusable workflows" (or restrict to specific actions if preferred)
2. **Fork pull request workflows:**
   - **Uncheck** "Run workflows from fork pull requests"
   - This prevents forked repos from running your CI, consuming your minutes, or potentially accessing secrets
3. **Workflow permissions:** should already be "Read and write" from Step 1

Click **Save** for each section.

---

## 8. General Settings

**Settings → General**

### Features

| Feature         | Recommended       | Why                                                                     |
| --------------- | ----------------- | ----------------------------------------------------------------------- |
| **Issues**      | On                | Bug reports and feature requests                                        |
| **Wikis**       | **Off**           | Project uses `docs/` directory instead — keeps docs versioned with code |
| **Projects**    | Off (unless used) | Only enable if using GitHub Projects for task tracking                  |
| **Discussions** | Optional          | Community Q&A — enable if you want it                                   |

### Pull Requests

| Setting                                           | Recommended | Why                            |
| ------------------------------------------------- | ----------- | ------------------------------ |
| **Allow squash merging**                          | On          | Clean single-commit merges     |
| **Allow merge commits**                           | **Off**     | Prevents noisy merge commits   |
| **Allow rebase merging**                          | On          | Linear history                 |
| **Always suggest updating pull request branches** | On          | Keeps PRs up to date           |
| **Automatically delete head branches**            | On          | Cleans up branches after merge |

### Danger Zone

- Verify **Visibility** is set correctly (Public or Private as intended)

---

## 9. Security Policy

A `SECURITY.md` file should exist in the repository root. This tells contributors how to report security vulnerabilities privately instead of opening public issues.

EyeOnChess includes a `SECURITY.md` with:

- Supported versions
- How to report (GitHub Security Advisories)
- What to include in reports
- Response timeline expectations
- In-scope and out-of-scope items

---

## Verification Checklist

After completing all steps, verify:

- [ ] **Workflow permissions** set to "Read and write"
- [ ] **Branch ruleset** active on `master` with Lint + Test status checks
- [ ] **Tag ruleset** active on `v*` pattern with creation/deletion restrictions
- [ ] **Production environment** created with required reviewer
- [ ] **Secrets** configured: `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SITE_URL`, `ADMIN_URL`
- [ ] **Dependabot alerts** enabled
- [ ] **Dependabot security updates** enabled
- [ ] **Push protection** enabled
- [ ] **Private vulnerability reporting** enabled
- [ ] **CodeQL code scanning** enabled (default setup)
- [ ] **Fork PR workflows** disabled
- [ ] **Wiki** disabled
- [ ] **Auto-delete head branches** enabled
- [ ] **`SECURITY.md`** present in repository root

---

## Quick Reference

| What                 | Where                                      |
| -------------------- | ------------------------------------------ |
| Workflow permissions | Settings → Actions → General → bottom      |
| Branch/tag rulesets  | Settings → Rules → Rulesets                |
| Environments         | Settings → Environments                    |
| Secrets              | Settings → Secrets and variables → Actions |
| Code security        | Settings → Code security                   |
| Actions security     | Settings → Actions → General               |
| General features     | Settings → General                         |
| Security policy      | `SECURITY.md` in repo root                 |
