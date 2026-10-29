# Design decisions

Short records of the main choices, the reasoning, and the alternatives considered.

## 1. Pull-based GitOps instead of push-based CD

**Decision:** ArgoCD inside the cluster pulls desired state from Git. CI never runs `kubectl` or `helm upgrade`.

**Why**
- Cluster credentials never leave the cluster — nothing to leak from CI.
- Every deployment is a Git commit: reviewable, auditable, revertible.
- Continuous reconciliation detects and reverts drift (`selfHeal`).
- Works for a laptop cluster: GitHub can't reach it, but ArgoCD can reach GitHub.

**Alternatives:** `helm upgrade` from CI (simpler, but credentials in CI and no drift control); Flux CD
(equally valid, more modular and CLI-centric — ArgoCD chosen for its UI and ApplicationSets).

## 2. Helm chart + per-environment values files

**Decision:** one chart in `charts/taskapp`, three small override files in `gitops/envs/`.

**Why:** environments stay structurally identical and differ only in explicit, reviewable values
(replicas, HPA, PDB, resources, host). CI edits a single key (`image.tag`).

**Alternatives:** Kustomize overlays (template-free, but patch-heavy for many differences); plain YAML per
environment (drifts quickly).

## 3. ApplicationSet with a list generator

**Decision:** a single ApplicationSet generates `taskapp-dev`, `taskapp-staging` and `taskapp-prod`.
A `templatePatch` adds `automated` sync only where `autoSync: true`.

**Why:** adding an environment is one list element; no copy-pasted Application manifests.

**Alternatives:** app-of-apps (good for bootstrapping many unrelated apps; planned for the Terraform phase);
three hand-written Applications.

## 4. Manual sync for prod

**Decision:** prod has no automated sync. A merged promotion PR leaves `taskapp-prod` *OutOfSync* until
someone clicks **Sync**.

**Why:** two gates (PR review + explicit sync) for production, while dev/staging stay fully automatic.

**Alternative:** auto-sync everywhere with a protected branch / CODEOWNERS on `gitops/envs/prod`.

## 5. Immutable `sha-<commit>` image tags

**Decision:** deploy only commit-SHA tags; `latest` is pushed for convenience but never referenced by GitOps.

**Why:** a tag always maps to one commit, rollbacks are exact, and `IfNotPresent` can't serve a stale image.

## 6. Build once, promote the same image

**Decision:** staging and prod receive the exact image built for dev; promotion copies the tag.

**Why:** what was tested is what ships. Rebuilding per environment can produce different bytes.

## 7. Trivy as a blocking gate before push

**Decision:** build with `load: true`, scan on the runner, push only if no fixable HIGH/CRITICAL CVEs
(`ignore-unfixed: true`).

**Why:** vulnerable images never reach the registry. Ignoring unfixed CVEs keeps the gate actionable.
The backend runtime image deletes the bundled npm/yarn — they're unused at runtime and a common CVE source.

## 8. Monorepo for app + config

**Decision:** code, chart and environment config live in one repository.

**Why:** simplest to clone, demo and review.

**Trade-off:** in larger organisations a separate config repo keeps CI commits out of app history and lets
platform teams own prod access. Only `repoURL` in the ApplicationSet would change.

## 9. Liveness ≠ readiness

**Decision:** `/healthz` checks only the process; `/readyz` checks the database.

**Why:** if liveness depended on the DB, a database outage would restart-loop every backend pod. A failing
readiness probe just removes the pod from Service endpoints until the DB returns.

## 10. Zero-downtime rollouts

**Decision:** `maxUnavailable: 0`, `maxSurge: 1`, readiness gating, graceful `SIGTERM` handling, exec-form `CMD`
so Node is PID 1 and receives the signal, PDB in staging/prod.

## 11. Restricted security context

**Decision:** `runAsNonRoot`, numeric UID (`USER 1000` / nginx UID 101), `allowPrivilegeEscalation: false`,
`capabilities.drop: [ALL]`, `seccompProfile: RuntimeDefault`, read-only root filesystem for the backend.

**Why a numeric UID:** Kubernetes can only verify `runAsNonRoot` for numeric users — `USER node` fails with
*"image has non-numeric user, cannot verify user is non-root"*.

## 12. nginx reverse proxy in the frontend image

**Decision:** nginx serves the SPA and proxies `/api/` to `BACKEND_URL` (templated with `envsubst` at start).

**Why:** single origin (no CORS), backend never exposed, the same image works in Compose and Kubernetes.

## 13. Postgres as a StatefulSet (demo scope)

**Decision:** in-cluster single-replica StatefulSet with a PVC.

**Why:** demonstrates stateful workloads (stable identity, `volumeClaimTemplates`, headless Service).
In production a managed database (Cloud SQL, RDS, Azure Database) or an operator such as CloudNativePG
would replace it.

## 14. Secrets in values files (temporary)

**Decision:** demo passwords live in env values files.

**Why / next step:** acceptable only for a local demo. Planned: Sealed Secrets (encrypted `SealedSecret`
committed to Git), or External Secrets Operator with a cloud secret manager.
