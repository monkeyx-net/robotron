#!/usr/bin/env bash
# Build and deploy the game to https://robotron.hatch.org
# (private S3 bucket behind CloudFront, as yourmom.com is).
# Usage: ./deploy.sh        (or: npm run deploy)
set -euo pipefail

BUCKET="<bucket>"
DIST_ID="${DIST_ID:-<distribution-id>}"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

npm run build
for f in dist/index.html dist/assets dist/sprites dist/sounds; do
  [[ -e "$f" ]] || { echo "build is missing $f" >&2; exit 1; }
done

# Hashed bundles never change under the same name: cache them for a year.
aws s3 sync dist/assets "s3://$BUCKET/assets" --delete \
  --cache-control "public, max-age=31536000, immutable"
# Sprites and sounds keep their names across releases: cache for an hour.
aws s3 sync dist "s3://$BUCKET" --delete --exclude "assets/*" --exclude "index.html" \
  --cache-control "public, max-age=3600"
aws s3 cp dist/index.html "s3://$BUCKET/index.html" \
  --content-type "text/html; charset=utf-8" --cache-control "public, max-age=60"

aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" \
  --query 'Invalidation.Id' --output text
echo "Deployed to https://$BUCKET/"
