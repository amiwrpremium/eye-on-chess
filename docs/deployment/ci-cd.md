# CI/CD Pipeline & Deployment

This guide covers the complete deployment pipeline: from pushing a git tag to having your changes live on a server with zero downtime.

## Overview

```
Developer pushes a version tag
  │
  ├── CI Workflow (existing)
  │     lint → test → build → compose smoke test
  │
  ├── Release Workflow (existing)
  │     Creates GitHub Release with auto-generated notes
  │
  └── CD Workflow (new)
        ├── Build 3 Docker images in parallel (api, web, worker)
        ├── Push to GitHub Container Registry (ghcr.io)
        └── SSH into VPS → pull images → sequential restart → health check
```

The CD workflow only runs on version tags (`v*`). Regular pushes to `master` only trigger CI (lint, test, build).

---

## Prerequisites

Before setting up the pipeline, you need:

1. **A GitHub repository** with Actions enabled (default for public repos)
2. **A VPS** running Ubuntu 22.04 or 24.04 with SSH access
3. **A domain** pointed at your VPS IP (optional but recommended)
4. **Ansible** installed on your local machine (for first-time server setup)
5. **GitHub CLI** (`gh`) installed locally (optional, for CLI-based setup)

---

## Step 1: GitHub Setup

You need to configure three things in your GitHub repository:

1. Workflow permissions (allow GHCR pushes)
2. Repository secrets (SSH credentials for deployment)
3. A deployment environment (optional, for protection rules)

### 1.1 Enable Workflow Write Permissions

The CD workflow needs to push Docker images to GHCR. By default, `GITHUB_TOKEN` has read-only access to packages.

#### Using GitHub UI

1. Go to your repository on GitHub
2. Click **Settings** (top tab bar)
3. In the left sidebar, expand **Actions** and click **General**
4. Scroll down to **Workflow permissions**
5. Select **Read and write permissions**
6. Click **Save**

#### Using `gh` CLI

```bash
# Check current permissions
gh api /repos/{owner}/{repo}/actions/permissions \
  --jq '.default_workflow_permissions'

# Set to read-write (requires admin access)
gh api -X PUT /repos/{owner}/{repo}/actions/permissions \
  --field default_workflow_permissions=write
```

Replace `{owner}/{repo}` with your GitHub username and repository name (e.g., `amiwrpremium/eye-on-chess`).

### 1.2 Add Repository Secrets

The CD workflow needs three secrets to SSH into your VPS and deploy:

| Secret            | Description                     | Example                             |
| ----------------- | ------------------------------- | ----------------------------------- |
| `SSH_HOST`        | Your VPS IP address or hostname | `203.0.113.50`                      |
| `SSH_USER`        | The deploy user on your VPS     | `deploy`                            |
| `SSH_PRIVATE_KEY` | Ed25519 private key for SSH     | Contents of `~/.ssh/deploy_ed25519` |

#### Using GitHub UI

1. Go to your repository on GitHub
2. Click **Settings**
3. In the left sidebar, expand **Secrets and variables** and click **Actions**
4. Click the **Secrets** tab
5. Click **New repository secret**
6. Enter the secret name (e.g., `SSH_HOST`) and value
7. Click **Add secret**
8. Repeat for `SSH_USER` and `SSH_PRIVATE_KEY`

#### Using `gh` CLI

```bash
# Set each secret interactively (prompts for value)
gh secret set SSH_HOST
gh secret set SSH_USER

# Set SSH key from a file
gh secret set SSH_PRIVATE_KEY < ~/.ssh/deploy_ed25519

# Or set with a value directly
gh secret set SSH_HOST --body "203.0.113.50"
gh secret set SSH_USER --body "deploy"
```

To verify your secrets are set:

```bash
gh secret list
```

This shows secret names (values are never displayed):

```
SSH_HOST    Updated 2026-03-25
SSH_PRIVATE_KEY   Updated 2026-03-25
SSH_USER    Updated 2026-03-25
```

### 1.3 Create a Deployment Environment (Optional)

Deployment environments add protection rules like required reviewers, wait timers, or branch restrictions. This is optional but recommended for production.

#### Using GitHub UI

1. Go to your repository on GitHub
2. Click **Settings**
3. In the left sidebar, click **Environments**
4. Click **New environment**
5. Name it `production` and click **Configure environment**
6. (Optional) Under **Deployment protection rules**:
   - Check **Required reviewers** and add yourself or your team
   - Check **Wait timer** and set a delay (e.g., 5 minutes) for a cooldown before deploy
7. (Optional) Under **Deployment branches and tags**:
   - Select **Selected branches and tags**
   - Add a rule: `v*` (only allow deploys from version tags)
8. Click **Save protection rules**

#### Using `gh` CLI

```bash
# Create the environment
gh api -X PUT /repos/{owner}/{repo}/environments/production

# Verify it was created
gh api /repos/{owner}/{repo}/environments --jq '.environments[].name'
```

Note: Protection rules (reviewers, wait timers, branch policies) can only be configured via the UI or REST API, not the `gh` CLI directly. To add a wait timer via API:

```bash
gh api -X POST /repos/{owner}/{repo}/environments/production \
  --field 'wait_timer=5'
```

### 1.4 Generate an SSH Key Pair for Deployments

If you don't already have a key pair for deployments, generate one:

```bash
# Generate a new Ed25519 key pair (no passphrase for automated deploys)
ssh-keygen -t ed25519 -f ~/.ssh/deploy_ed25519 -N "" -C "github-actions-deploy"

# View the public key (you'll add this to the server)
cat ~/.ssh/deploy_ed25519.pub

# The private key goes into the SSH_PRIVATE_KEY secret
cat ~/.ssh/deploy_ed25519
```

---

## Step 2: First-Time Server Setup (Ansible)

The Ansible playbook automates the initial server configuration:

- Installs Docker CE and Docker Compose plugin
- Creates a `deploy` user with Docker access
- Configures SSH for GitHub Actions
- Logs into GHCR for image pulls
- Clones the repository
- Templates the `.env` file with your secrets
- Pulls images and starts all services
- Sets up daily database backups (3 AM)

### 2.1 Install Ansible

```bash
# macOS
brew install ansible

# Ubuntu/Debian
sudo apt install ansible

# pip (any OS)
pip install ansible
```

### 2.2 Configure Inventory

```bash
cd deployment/ansible

# Copy the example inventory
cp inventory.example.yml inventory.yml

# Edit with your server details
```

Edit `inventory.yml`:

```yaml
all:
  hosts:
    eyeonchess:
      ansible_host: 203.0.113.50 # Your VPS IP
      ansible_user: root # Root for first-time setup
      ansible_ssh_private_key_file: ~/.ssh/id_ed25519
```

### 2.3 Generate Secrets

Before running the playbook, generate your secrets:

```bash
# Generate random passwords
POSTGRES_PASSWORD=$(openssl rand -hex 16)
REDIS_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)

echo "POSTGRES_PASSWORD: $POSTGRES_PASSWORD"
echo "REDIS_PASSWORD: $REDIS_PASSWORD"
echo "JWT_SECRET: $JWT_SECRET"
```

Save these values — you'll need them for the playbook.

### 2.4 Create a GitHub Personal Access Token

The deploy user needs a GitHub PAT to pull images from GHCR.

#### Using GitHub UI

1. Go to https://github.com/settings/tokens?type=beta (Fine-grained tokens)
2. Click **Generate new token**
3. Name it `eyeonchess-deploy`
4. Under **Repository access**, select **Only select repositories** and pick your repo
5. Under **Permissions → Packages**, select **Read**
6. Click **Generate token**
7. Copy the token — you'll pass it to Ansible

#### Using `gh` CLI

Fine-grained tokens can't be created via CLI yet. Use a classic token instead:

1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Select scope: `read:packages`
4. Copy the token

### 2.5 Run the Playbook

```bash
cd deployment/ansible

ansible-playbook -i inventory.yml playbook.yml \
  --extra-vars '{
    "deploy_ssh_public_key": "'"$(cat ~/.ssh/deploy_ed25519.pub)"'",
    "github_pat": "ghp_YOUR_TOKEN_HERE",
    "postgres_password": "YOUR_POSTGRES_PASSWORD",
    "redis_password": "YOUR_REDIS_PASSWORD",
    "jwt_secret": "YOUR_JWT_SECRET",
    "seed_user_password": "YOUR_ADMIN_PASSWORD",
    "site_url": "http://your-domain.com",
    "grafana_admin_password": "YOUR_GRAFANA_PASSWORD"
  }'
```

Or use an Ansible Vault file for secrets:

```bash
# Create an encrypted vars file
ansible-vault create vars/secrets.yml

# Add your secrets in the editor that opens:
# deploy_ssh_public_key: "ssh-ed25519 AAAA..."
# github_pat: "ghp_..."
# postgres_password: "..."
# redis_password: "..."
# jwt_secret: "..."
# seed_user_password: "..."
# site_url: "http://your-domain.com"
# grafana_admin_password: "..."

# Run with vault
ansible-playbook -i inventory.yml playbook.yml \
  --extra-vars @vars/secrets.yml \
  --ask-vault-pass
```

### 2.6 Verify the Setup

After the playbook completes:

```bash
# SSH into the server as the deploy user
ssh deploy@203.0.113.50

# Check all services are running
cd /opt/eyeonchess
docker compose -f deployment/docker-compose.cd.yml ps

# Check health
curl http://localhost/health
# Expected: {"status":"ok","postgres":{"status":"up",...},"redis":{"status":"up",...}}

# Check the site
curl -I http://your-domain.com
# Expected: HTTP/1.1 200 OK
```

---

## Step 3: How to Deploy

Once the server is set up and GitHub secrets are configured, deploying is a two-step process:

### 3.1 Tag and Push

```bash
# Bump version in package.json files (if not already done)
# Then tag and push:
git tag v1.2.0
git push origin master --tags
```

This triggers three workflows in parallel:

- **CI**: lint, test, build, compose smoke test
- **Release**: creates a GitHub Release
- **CD**: builds images, pushes to GHCR, deploys to VPS

### 3.2 Monitor the Deployment

#### Using `gh` CLI

```bash
# Watch the CD workflow in real-time
gh run watch

# Or list recent runs and pick one
gh run list --workflow=cd.yml

# View a specific run
gh run view <run-id>

# View logs for a failed run
gh run view <run-id> --log-failed
```

#### Using GitHub UI

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. Click the **CD** workflow in the left sidebar
4. Click the latest run to see progress
5. Click a job (e.g., "Deploy to VPS") to see live logs

### 3.3 What Happens During Deployment

1. **Build** (parallel, ~2-3 min): Three images (api, web, worker) are built in parallel on GitHub Actions runners
2. **Push** (~30s): Images are pushed to `ghcr.io/{owner}/eye-on-chess/{api,web,worker}:{version}`
3. **Deploy** (~1 min): GitHub Actions SSHs into your VPS and runs:
   - `docker compose pull api web worker` — downloads new images
   - `docker compose up -d --no-deps api` — restarts API (runs migrations on start)
   - Waits 10 seconds for API health
   - `docker compose up -d --no-deps web` — restarts web frontend
   - Waits 5 seconds
   - `docker compose up -d --no-deps worker` — restarts analysis worker
   - Polls `/health` endpoint up to 30 times to confirm

### 3.4 Zero-Downtime Behavior

- **Brief interruption** (~2-5 seconds per service): When a container restarts, Nginx gets connection errors until the new container is ready
- **WebSocket reconnection**: Socket.IO clients automatically reconnect with exponential backoff (1s to 10s). Active games survive because state is in PostgreSQL and Redis, not in container memory
- **Database migrations**: The API container runs `prisma migrate deploy` on startup. Most migrations are additive (new columns/tables) and complete in under a second. For large migrations, consider a maintenance window

---

## Step 4: How to Deploy Manually

If the CD pipeline fails or you need to deploy without pushing a tag:

```bash
# SSH into your server
ssh deploy@your-server

# Navigate to the app directory
cd /opt/eyeonchess

# Pull the latest code (for compose file updates, config changes)
git pull origin master

# Deploy a specific version
IMAGE_TAG=1.2.0 make deploy

# Or deploy the latest
make deploy
```

The `make deploy` command:

1. Pulls the specified image tag from GHCR
2. Restarts services sequentially (api → web → worker)
3. Waits for health checks between restarts

---

## Step 5: How to Rollback

If a deployment causes issues, roll back to a previous version:

### Quick Rollback

```bash
ssh deploy@your-server
cd /opt/eyeonchess

# Rollback to version 1.1.5
make rollback IMAGE_TAG=1.1.5
```

This pulls the old image tags from GHCR and restarts all services. Every version tag pushed to GHCR is retained, so you can roll back to any previous release.

### Verify After Rollback

```bash
# Check health
curl http://localhost/health

# Check which images are running
docker compose -f deployment/docker-compose.cd.yml ps
docker inspect eyeonchess-api --format '{{.Config.Image}}'
# Expected: ghcr.io/amiwrpremium/eye-on-chess/api:1.1.5
```

### Rollback Database Migrations

If the new version included a database migration that needs to be undone:

```bash
# Restore from a backup taken before the deployment
make restore FILE=backups/eyeonchess_20260325_030000.sql.gz
```

Backups are created automatically every day at 3 AM. Always verify you have a recent backup before deploying.

---

## Troubleshooting

### GHCR Authentication Failures

**Symptom**: CD workflow fails at "Push images" with `denied: permission_denied`

**Fix**:

1. Verify workflow permissions are set to "Read and write":
   ```bash
   gh api /repos/{owner}/{repo}/actions/permissions \
     --jq '.default_workflow_permissions'
   # Should output: "write"
   ```
2. If it shows "read", update it:
   ```bash
   gh api -X PUT /repos/{owner}/{repo}/actions/permissions \
     --field default_workflow_permissions=write
   ```

**On the VPS**: If `docker compose pull` fails with auth errors:

```bash
# Re-login to GHCR
docker login ghcr.io -u YOUR_GITHUB_USERNAME -p YOUR_GITHUB_PAT
```

### SSH Connection Refused

**Symptom**: CD workflow fails at "Deploy via SSH" with `connection refused` or `timeout`

**Checks**:

1. Verify the VPS IP is correct:
   ```bash
   gh secret list  # Check SSH_HOST is set
   ```
2. Verify SSH is running on the VPS:
   ```bash
   ssh deploy@YOUR_VPS_IP "echo ok"
   ```
3. Verify the deploy user exists and has the right SSH key:
   ```bash
   ssh deploy@YOUR_VPS_IP "whoami && docker ps"
   ```
4. Check firewall allows port 22:
   ```bash
   ssh root@YOUR_VPS_IP "ufw status"
   ```

### Health Check Timeout

**Symptom**: Deploy succeeds but health check fails after 90 seconds

**Checks**:

```bash
ssh deploy@your-server
cd /opt/eyeonchess

# Check container status
docker compose -f deployment/docker-compose.cd.yml ps

# Check API logs
docker compose -f deployment/docker-compose.cd.yml logs --tail=50 api

# Common causes:
# - Database migration failed (check API logs for Prisma errors)
# - Redis connection failed (check REDIS_PASSWORD in .env)
# - Port conflict (another service on port 80)
```

### Disk Space Full

**Symptom**: `docker pull` fails with "no space left on device"

**Fix**:

```bash
# Remove unused Docker resources
docker system prune -f

# Remove old images (older than 7 days)
docker image prune -a --filter "until=168h"

# Check disk usage
df -h
docker system df
```

### Migration Failures During Restart

**Symptom**: API container starts but immediately exits. Logs show Prisma migration errors.

**Fix**:

```bash
# Check API logs
docker compose -f deployment/docker-compose.cd.yml logs api

# If a migration failed, you may need to:
# 1. Fix the migration issue
# 2. Rollback to previous version: make rollback IMAGE_TAG=<previous>
# 3. Restore database: make restore FILE=backups/<latest>.sql.gz
```

### WebSocket Disconnections During Deploy

**Expected behavior**: Active Socket.IO connections drop for 2-5 seconds when the API container restarts. Clients automatically reconnect with exponential backoff (1s → 2s → 4s → 8s → 10s max, up to 10 attempts).

**If clients don't reconnect**: Check that the Nginx WebSocket proxy configuration hasn't changed:

```bash
# Nginx should have these headers for /socket.io/
grep -A5 "socket.io" /opt/eyeonchess/deployment/nginx.conf
# Should show: proxy_http_version 1.1, Upgrade, Connection headers
```

---

## Architecture Notes

### Why a Standalone CD Compose File?

`docker-compose.cd.yml` is a standalone file (not an override of `docker-compose.yml`) because:

- It avoids Docker Compose merge complexity and version requirements
- The production compose (`docker-compose.yml`) continues to work for local `make up` builds
- Infrastructure services are identical — only the three app services differ (GHCR images vs local builds)

### Why Sequential Restart (Not Blue-Green)?

Blue-green deployment requires two sets of containers and an Nginx upstream switch. For a single-VPS setup, this doubles the memory requirement and adds complexity. Sequential restart with health checks provides near-zero downtime with much simpler infrastructure.

### Why Plain `docker build` (Not Buildx)?

Buildx runs in a separate builder context where locally-built images (like `eyeonchess-base`) are not visible. Since we need to build the base image first and then reference it in app Dockerfiles via `FROM eyeonchess-base`, plain `docker build` is simpler and avoids builder context issues. Buildx is only needed for multi-platform builds, which aren't required for a single-architecture VPS.

### Image Retention

Every version tag pushed to GHCR is retained indefinitely. The `:latest` tag always points to the most recent successful build. Old versions can be used for rollbacks at any time.

To clean up old images from GHCR (optional):

```bash
# List image versions
gh api /user/packages/container/eye-on-chess%2Fapi/versions \
  --jq '.[].metadata.container.tags'

# Delete a specific version (by version ID)
gh api -X DELETE /user/packages/container/eye-on-chess%2Fapi/versions/<version-id>
```

---

## GitLab CI/CD

EyeOnChess also ships a `.gitlab-ci.yml` that mirrors the GitHub Actions pipeline. It works on both gitlab.com and self-hosted GitLab instances (e.g., your own GitLab).

### Pipeline Stages

| Stage    | Jobs                                          | Trigger                                |
| -------- | --------------------------------------------- | -------------------------------------- |
| `lint`   | eslint, prettier, typescript                  | Push to default branch, MRs, `v*` tags |
| `test`   | test-chess, test-api, test-web (parallel)     | Push to default branch, MRs, `v*` tags |
| `build`  | build-api, build-web, build-worker (parallel) | `v*` tags only                         |
| `deploy` | deploy-production (manual trigger)            | `v*` tags only                         |

### GitLab Setup

#### 1. Enable Container Registry

On gitlab.com, the container registry is enabled by default. On self-hosted GitLab:

1. Go to **Admin Area** → **Settings** → **CI/CD** → **Container Registry**
2. Enable the registry and set the URL

#### 2. Add CI/CD Variables

Go to your project → **Settings** → **CI/CD** → **Variables** → **Add variable**:

| Variable          | Value                               | Flags                        |
| ----------------- | ----------------------------------- | ---------------------------- |
| `SSH_HOST`        | Your VPS IP                         | Protected                    |
| `SSH_USER`        | `deploy`                            | Protected                    |
| `SSH_PRIVATE_KEY` | Contents of `~/.ssh/deploy_ed25519` | Protected, Masked, File type |
| `SITE_URL`        | `http://your-domain.com`            | Protected                    |

The `CI_REGISTRY`, `CI_REGISTRY_USER`, `CI_REGISTRY_PASSWORD`, and `CI_REGISTRY_IMAGE` variables are provided automatically by GitLab — you don't need to set them.

#### 3. Create a Production Environment

1. Go to **Operate** → **Environments** → **New environment**
2. Name: `production`, External URL: your site URL
3. Save

#### 4. Configure the VPS for GitLab Registry

On the VPS, log in to the GitLab container registry:

```bash
# For gitlab.com
docker login registry.gitlab.com -u YOUR_GITLAB_USERNAME -p YOUR_GITLAB_PAT

# For self-hosted (replace with your registry URL)
docker login registry.your-gitlab.com -u YOUR_USERNAME -p YOUR_PAT
```

Set the `IMAGE_REGISTRY` variable on the VPS so `docker-compose.cd.yml` pulls from GitLab instead of GHCR:

```bash
# Add to /opt/eyeonchess/.env
echo 'IMAGE_REGISTRY=registry.gitlab.com/your-username/eye-on-chess' >> /opt/eyeonchess/.env
```

#### 5. Deploy

Push a tag to trigger the pipeline:

```bash
git tag v1.2.0
git push gitlab v1.2.0
```

The lint and test stages run automatically. The build stage pushes images to the GitLab Container Registry. The deploy stage requires **manual approval** — click the play button in the GitLab UI to deploy.

#### 6. Mirroring from GitHub

If your primary remote is GitHub and you want to mirror to GitLab:

```bash
# Add GitLab as a second remote
git remote add gitlab https://gitlab.com/your-username/eye-on-chess.git

# Push to both
git push origin master --tags
git push gitlab master --tags
```

Or set up GitLab's built-in mirroring: **Settings** → **Repository** → **Mirroring repositories** → add the GitHub URL.

### Key Differences from GitHub Actions

| Feature            | GitHub Actions             | GitLab CI                  |
| ------------------ | -------------------------- | -------------------------- |
| Registry           | GHCR (ghcr.io)             | GitLab Container Registry  |
| Deploy trigger     | Automatic on tag           | Manual (click play button) |
| Pipeline file      | `.github/workflows/cd.yml` | `.gitlab-ci.yml`           |
| Secrets            | Repository Secrets         | CI/CD Variables            |
| Environments       | Settings → Environments    | Operate → Environments     |
| Image registry var | Hardcoded in workflow      | Auto: `$CI_REGISTRY_IMAGE` |

---

## Quick Reference

| Action               | Command                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Deploy new version   | `git tag v1.2.0 && git push origin master --tags`                                                          |
| Watch deployment     | `gh run watch`                                                                                             |
| Deploy manually      | `ssh deploy@server "cd /opt/eyeonchess && IMAGE_TAG=1.2.0 make deploy"`                                    |
| Rollback             | `ssh deploy@server "cd /opt/eyeonchess && make rollback IMAGE_TAG=1.1.5"`                                  |
| Check health         | `curl http://your-domain/health`                                                                           |
| View logs            | `ssh deploy@server "cd /opt/eyeonchess && docker compose -f deployment/docker-compose.cd.yml logs -f api"` |
| Backup database      | `ssh deploy@server "cd /opt/eyeonchess && make backup"`                                                    |
| Check running images | `ssh deploy@server "docker inspect eyeonchess-api --format '{{.Config.Image}}'"`                           |
