# Setup guide

This guide takes you from a fresh machine to the full GitOps flow: a push to `main` showing up in the dev
environment, then being promoted to staging and prod.

## 1. Prerequisites

| Tool | Version tested | Purpose |
| --- | --- | --- |
| Docker Desktop (or Docker Engine) | 29.x | Runs containers and the kind nodes |
| kind | 0.27+ | Local Kubernetes cluster |
| kubectl | 1.32+ | Kubernetes CLI |
| Helm | 3.17+ | Chart linting / installs (metrics-server) |
| Git | any recent | Version control |
| yq *(optional)* | 4.x | Needed only to run `scripts/promote.sh` locally |
| Node.js *(optional)* | 22+ | Only for running the apps outside Docker |

Give Docker at least **8 GB of memory** (16 GB recommended for all three environments plus ArgoCD).

### Install on Windows (PowerShell)

```powershell
winget install Docker.DockerDesktop
winget install Kubernetes.kind
winget install Kubernetes.kubectl
winget install Helm.Helm
winget install MikeFarah.yq
```

Open a new terminal afterwards so `PATH` updates. Run the `.sh` scripts from **Git Bash** or **WSL 2**.

On WSL 2 you can cap memory in `%UserProfile%\.wslconfig`:

```ini
[wsl2]
memory=12GB
```

### Install on macOS

```bash
brew install --cask docker
brew install kind kubectl helm yq
```

### Install on Linux

Follow the official guides for [Docker Engine](https://docs.docker.com/engine/install/),
[kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation),
[kubectl](https://kubernetes.io/docs/tasks/tools/) and [Helm](https://helm.sh/docs/intro/install/).

## 2. Run the app with Docker Compose

```bash
git clone https://github.com/ayush-anand01/gitops-platform.git
cd gitops-platform
docker compose up --build -d
```

Open http://localhost:8080. Stop with `docker compose down` (add `-v` to delete the database volume).

## 3. One-time GitHub configuration

These are needed for CI to publish images and for ArgoCD to pull them.

1. **Workflow permissions** — *Settings → Actions → General → Workflow permissions*:
   - select **Read and write permissions**
   - tick **Allow GitHub Actions to create and approve pull requests** (used by the Promote workflow)
2. **Let the first CI run finish** (push to `main`, or re-run it from *Actions → CI → Run workflow*
   after changing the permissions above). It creates two packages: `taskapp-backend` and `taskapp-frontend`.
3. **Make both packages public** — *your profile → Packages → package → Package settings → Change visibility → Public*.
   (Private packages would need an `imagePullSecret` in every namespace.)

> Forking? Replace `ayush-anand01` with your GitHub username in `charts/`, `gitops/` and the Dockerfile labels:
> `grep -rl ayush-anand01 charts gitops app | xargs sed -i 's/ayush-anand01/<you>/g'`

## 4. Create the platform

```bash
./scripts/bootstrap.sh
```

What it does:

1. Creates the kind cluster `gitops` (1 control plane + 2 workers) from `infra/kind-config.yaml`
2. Installs ingress-nginx (kind provider manifest) and waits for it
3. Installs metrics-server via Helm (for HPA and `kubectl top`)
4. Installs ArgoCD and waits for all its deployments
5. Applies `gitops/argocd/project.yaml` and `gitops/argocd/applicationset.yaml`
6. Prints the ArgoCD admin password and the app URLs

Check progress:

```bash
kubectl get applications -n argocd
kubectl get pods -A
```

## 5. Open the UIs

```bash
kubectl -n argocd port-forward svc/argocd-server 8081:443
```

| What | URL |
| --- | --- |
| ArgoCD | https://localhost:8081 (user `admin`, password printed by bootstrap; accept the self-signed cert) |
| dev | http://dev.taskapp.localtest.me |
| staging | http://staging.taskapp.localtest.me |
| prod | http://taskapp.localtest.me — click **Sync** on `taskapp-prod` in ArgoCD first |

Retrieve the ArgoCD password later with:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d; echo
```

## 6. End-to-end demo

1. Change something visible, e.g. the `<h1>` in `app/frontend/src/App.tsx`, commit and push to `main`.
2. Watch **Actions → CI**: `test` and `helm-lint` → `build` (Trivy) → `deploy-dev`.
3. A commit `deploy(dev): sha-xxxxxxx` appears on `main`.
4. In ArgoCD, `taskapp-dev` goes *OutOfSync → Syncing → Synced/Healthy* (click **Refresh** to skip the ~3 min poll).
5. Reload http://dev.taskapp.localtest.me — the badge shows the new `sha-` version.
6. **Actions → Promote → Run workflow** with `dev → staging`. Review and merge the PR it opens. Staging updates.
7. Repeat with `staging → prod`, merge, then click **Sync** on `taskapp-prod`.

### Show self-healing

```bash
kubectl -n taskapp-dev scale deploy taskapp-backend --replicas=5
kubectl -n taskapp-dev get deploy taskapp-backend -w   # ArgoCD restores 1 replica
```

### Show autoscaling (prod)

```bash
kubectl -n taskapp-prod get hpa -w
# in another terminal, generate load:
kubectl -n taskapp-prod run load --rm -it --image=busybox:1.37 --restart=Never -- \
  sh -c 'while true; do wget -qO- http://taskapp-backend:3000/api/tasks >/dev/null; done'
```

### Roll back

```bash
git log --oneline -- gitops/envs/dev/values.yaml   # find the deploy commit
git revert <sha> && git push                       # ArgoCD deploys the previous tag
```

## 7. Tear down

```bash
./scripts/teardown.sh        # deletes the kind cluster
docker compose down -v       # if you used Compose
```

## Corporate networks

If your network inspects TLS (a company root CA re-signs HTTPS), tools inside containers — Trivy, and image
pulls from the kind nodes — may fail with `x509: certificate signed by unknown authority`. Use a network
without TLS inspection, or add the corporate CA to the kind nodes. GitHub-hosted CI runners are unaffected.
