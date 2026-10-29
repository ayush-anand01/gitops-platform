# Contributing

1. Branch from `main` and open a pull request — CI runs lint, tests, Helm validation and the Trivy scan.
2. Keep application, chart and environment changes in separate PRs where possible.
3. Never edit image tags in `gitops/envs/*` by hand: CI sets dev, and the **Promote** workflow moves tags
   to staging and prod.
4. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `ci:`, `docs:`, `chore:`).

## Local checks

```bash
(cd app/backend && npm ci && npm run lint && npm test)
(cd app/frontend && npm ci && npm run lint && npm run build)
for env in dev staging prod; do helm lint charts/taskapp -f gitops/envs/$env/values.yaml; done
docker compose up --build
```
