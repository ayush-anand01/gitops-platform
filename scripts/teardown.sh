#!/usr/bin/env bash
# Deletes the whole local cluster (all environments and ArgoCD).
set -euo pipefail
kind delete cluster --name gitops
