# Runbook

Day-2 operations for the TaskApp platform.

## Common tasks

| Task | How |
| --- | --- |
| Deploy to dev | Merge to `main`. CI commits the new tag; ArgoCD syncs. |
| Promote dev → staging | *Actions → Promote → Run workflow* (`dev` → `staging`), merge the PR |
| Promote staging → prod | Same with `staging` → `prod`, merge, then **Sync** `taskapp-prod` in ArgoCD |
| Promote locally | `./scripts/promote.sh dev staging`, commit, open a PR |
| Roll back | `git revert <deploy commit>` and push (preferred), or ArgoCD → *History and Rollback* |
| Force a refresh | ArgoCD UI → app → **Refresh**, or `kubectl -n argocd annotate app taskapp-dev argocd.argoproj.io/refresh=hard --overwrite` |
| Change config | Edit `gitops/envs/<env>/values.yaml` via PR (the config checksum rolls the pods) |
| Scale | Edit `replicas` (dev/staging) or `autoscaling.*` (prod) in the env values file |

> Never `kubectl edit` resources managed by ArgoCD in dev/staging — self-heal reverts it. Change Git instead.

## Inspecting state

```bash
kubectl get applications -n argocd                       # sync + health per environment
kubectl get all,ingress,hpa,pdb,pvc -n taskapp-prod
kubectl rollout status deploy/taskapp-backend -n taskapp-dev
kubectl logs deploy/taskapp-backend -n taskapp-dev -f
kubectl logs <pod> -n taskapp-dev --previous            # logs of the crashed container
kubectl describe pod <pod> -n taskapp-dev               # events: pulls, probes, scheduling
kubectl top pods -n taskapp-prod                        # CPU/memory (metrics-server)
kubectl get events -n taskapp-dev --sort-by=.lastTimestamp
```

Check what version is live:

```bash
curl -s http://dev.taskapp.localtest.me/api/info
```

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `ImagePullBackOff` | GHCR package private, or tag not pushed yet | Make the package public; confirm the tag exists in GHCR |
| `CreateContainerConfigError: image has non-numeric user` | `runAsNonRoot` with a named `USER` | Use a numeric UID in the Dockerfile |
| `CrashLoopBackOff` (backend) | Bad config/secret, or OOMKilled (exit 137) | `logs --previous`, `describe pod`, check limits |
| Backend `0/1 Ready`, no restarts | DB not ready → `/readyz` returns 503 | Check the postgres pod and logs "DB not ready (attempt n/10)" |
| Postgres pod `Pending` | PVC can't bind | `kubectl get pvc`; kind's `standard` StorageClass must exist |
| App `OutOfSync` (prod) | Manual sync by design | ArgoCD → **Sync** |
| App `Unknown` / `ComparisonError` | Repo unreachable or wrong path/values file | Check the repo is public and paths in the ApplicationSet |
| App `Degraded` | Pods failing probes | Inspect pods as above |
| HPA `<unknown>/70%` | metrics-server not ready, or no CPU request | `kubectl top pods`; requests are set in the chart |
| `*.localtest.me` not loading | Port 80 in use on the host | Windows: `netstat -ano \| findstr :80`; free it and recreate the cluster |
| CI `deploy-dev` push rejected | Concurrent commit to `main` | The job rebases; re-run it |
| Promote: "not permitted to create pull requests" | Repo setting off | *Settings → Actions → General* → allow Actions to create PRs |
| CI Trivy job fails | New fixable CVE in a dependency/base image | Update the dependency or base image tag (Dependabot PRs help) |
| `x509: certificate signed by unknown authority` locally | Corporate TLS inspection | Use another network or trust the corporate CA in the tool/container |

## Disaster recovery (local)

The cluster is disposable — Git holds the desired state.

```bash
./scripts/teardown.sh
./scripts/bootstrap.sh     # ArgoCD re-creates every environment from Git
```

Database data lives in PVCs and is lost with the cluster (demo scope). Back up first if needed:

```bash
kubectl exec -n taskapp-prod taskapp-postgres-0 -- pg_dump -U taskapp taskapp > backup.sql
```
