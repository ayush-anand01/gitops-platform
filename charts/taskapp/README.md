# taskapp Helm chart

Deploys the TaskApp frontend, backend and PostgreSQL. In this repository ArgoCD renders it with
`gitops/envs/<env>/values.yaml`; it can also be installed directly with Helm.

```bash
helm lint charts/taskapp -f gitops/envs/dev/values.yaml
helm template taskapp charts/taskapp -f gitops/envs/dev/values.yaml
helm upgrade --install taskapp charts/taskapp -n taskapp-dev --create-namespace -f gitops/envs/dev/values.yaml
```

## Resources

| Kind | Name | Condition |
| --- | --- | --- |
| ConfigMap | `<release>-config` | always |
| Secret | `<release>-db` | always |
| Deployment, Service | `<release>-backend` | always |
| HorizontalPodAutoscaler | `<release>-backend` | `backend.autoscaling.enabled` |
| PodDisruptionBudget | `<release>-backend` | `backend.pdb.enabled` |
| Deployment, Service | `<release>-frontend` | always |
| StatefulSet, headless Service | `<release>-postgres` | `postgres.enabled` |
| Ingress | `<release>` | `ingress.enabled` |

## Values

| Key | Default | Description |
| --- | --- | --- |
| `environment` | `dev` | Exposed as `APP_ENV` and the `environment` label |
| `imagePullSecrets` | `[]` | For private registries |
| `backend.image.repository` | `ghcr.io/ayush-anand01/taskapp-backend` | |
| `backend.image.tag` | `latest` | Overridden per env with `sha-<commit>` |
| `backend.replicas` | `1` | Ignored when autoscaling is enabled |
| `backend.port` | `3000` | |
| `backend.resources` | 50m/64Mi → 250m/256Mi | Requests → limits |
| `backend.autoscaling.enabled` | `false` | Creates an HPA and omits `replicas` |
| `backend.autoscaling.minReplicas` / `maxReplicas` | `2` / `5` | |
| `backend.autoscaling.targetCPUUtilizationPercentage` | `70` | Relative to the CPU request |
| `backend.pdb.enabled` / `minAvailable` | `false` / `1` | |
| `frontend.image.repository` | `ghcr.io/ayush-anand01/taskapp-frontend` | |
| `frontend.image.tag` | `latest` | |
| `frontend.replicas` | `1` | |
| `frontend.port` | `8080` | nginx-unprivileged port |
| `frontend.resources` | 20m/32Mi → 100m/128Mi | |
| `postgres.enabled` | `true` | Disable to use an external database |
| `postgres.image` | `postgres:16-alpine` | |
| `postgres.storage` | `1Gi` | PVC size |
| `postgres.database` / `user` | `taskapp` / `taskapp` | |
| `postgres.password` | `change-me` | Demo only — use Sealed/External Secrets in real setups |
| `ingress.enabled` | `true` | |
| `ingress.className` | `nginx` | |
| `ingress.host` | `taskapp.localtest.me` | |
| `podSecurityContext` | non-root, seccomp RuntimeDefault | Applied to app pods |
| `containerSecurityContext` | no privilege escalation, drop ALL | Applied to app containers |

## Notes

- A `checksum/config` annotation rolls backend pods whenever the ConfigMap changes.
- Backend rolling updates use `maxUnavailable: 0` / `maxSurge: 1` for zero downtime.
- Selectors use only `app.kubernetes.io/name` and `instance`, because Deployment selectors are immutable.
