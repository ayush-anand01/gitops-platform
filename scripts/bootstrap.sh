#!/usr/bin/env bash
# Creates the local platform: kind cluster + ingress-nginx + metrics-server + ArgoCD + TaskApp apps.
# Run from the repo root in Git Bash or WSL:  ./scripts/bootstrap.sh
set -euo pipefail

CLUSTER=gitops
ARGOCD_VERSION=v2.14.11

step() { printf "\n\033[1;34m==> %s\033[0m\n" "$*"; }

for bin in docker kind kubectl helm; do
  command -v "$bin" >/dev/null || { echo "Missing: $bin (see README: Prerequisites)"; exit 1; }
done

step "Creating kind cluster '$CLUSTER'"
if kind get clusters | grep -qx "$CLUSTER"; then
  echo "Cluster already exists, skipping"
else
  kind create cluster --config infra/kind-config.yaml
fi
kubectl cluster-info --context "kind-$CLUSTER"

step "Installing ingress-nginx"
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait -n ingress-nginx --for=condition=ready pod -l app.kubernetes.io/component=controller --timeout=180s

step "Installing metrics-server (needed for HPA)"
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ >/dev/null
helm upgrade --install metrics-server metrics-server/metrics-server -n kube-system \
  --set args="{--kubelet-insecure-tls}" --wait

step "Installing ArgoCD $ARGOCD_VERSION"
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd --server-side -f "https://raw.githubusercontent.com/argoproj/argo-cd/$ARGOCD_VERSION/manifests/install.yaml"
kubectl wait -n argocd --for=condition=available deploy --all --timeout=300s

step "Registering TaskApp project + ApplicationSet"
kubectl apply -f gitops/argocd/project.yaml
kubectl apply -f gitops/argocd/applicationset.yaml

step "Done"
password=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d)
cat <<EOF

ArgoCD UI:   kubectl -n argocd port-forward svc/argocd-server 8081:443
             then open https://localhost:8081  (user: admin, password: $password)

App URLs (once synced):
  dev      http://dev.taskapp.localtest.me
  staging  http://staging.taskapp.localtest.me
  prod     http://taskapp.localtest.me   (manual sync in ArgoCD)
EOF
