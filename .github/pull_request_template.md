## What

<!-- Short description of the change -->

## Type

- [ ] Application code (`app/`)
- [ ] Helm chart (`charts/`)
- [ ] Environment config / promotion (`gitops/`)
- [ ] CI/CD or tooling

## Checklist

- [ ] CI is green (tests, Helm lint, Trivy)
- [ ] Chart changes render for dev, staging and prod
- [ ] Docs updated if behaviour changed
- [ ] For `gitops/envs/prod`: the same tag has run in staging
