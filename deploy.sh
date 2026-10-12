#!/usr/bin/env bash
# Build and deploy the game to a private S3 bucket behind CloudFront.
# Usage: ./deploy.sh        (or: npm run deploy)
#
# The bucket and distribution come from the environment, or from a local,
# git-ignored .env.deploy file (copy .env.deploy.example):
#   DEPLOY_BUCKET=<s3 bucket name>
#   DEPLOY_DIST_ID=<cloudfront distribution id>
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

if [[ -f .env.deploy ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.deploy
  set +a
fi
: "${DEPLOY_BUCKET:?set DEPLOY_BUCKET (see .env.deploy.example)}"
: "${DEPLOY_DIST_ID:?set DEPLOY_DIST_ID (see .env.deploy.example)}"

npm run build
for f in dist/index.html dist/assets dist/sprites dist/sounds; do
  [[ -e "$f" ]] || { echo "build is missing $f" >&2; exit 1; }
done

# Hashed bundles never change under the same name: cache them for a year.
aws s3 sync dist/assets "s3://$DEPLOY_BUCKET/assets" --delete \
  --cache-control "public, max-age=31536000, immutable"
# Sprites and sounds keep their names across releases: cache for an hour.
aws s3 sync dist "s3://$DEPLOY_BUCKET" --delete --exclude "assets/*" --exclude "index.html" \
  --cache-control "public, max-age=3600"
aws s3 cp dist/index.html "s3://$DEPLOY_BUCKET/index.html" \
  --content-type "text/html; charset=utf-8" --cache-control "public, max-age=60"

aws cloudfront create-invalidation --distribution-id "$DEPLOY_DIST_ID" --paths "/*" \
  --query 'Invalidation.Id' --output text
echo "Deployed to s3://$DEPLOY_BUCKET (CloudFront invalidation started)"
