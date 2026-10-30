#!/usr/bin/env bash
# Builds the production app with a free Apple team and installs it on the iPhone named BARRY_IPHONE, connected and
# unlocked. docs/iphone.md describes the steps.
set -euo pipefail

iphone="${BARRY_IPHONE:-Mirone}"
export LANG=en_US.UTF-8

APP_VARIANT=production BARRY_WITHOUT_PUSH=1 npx expo prebuild --clean --platform ios

# The hosted Supabase URL, the publishable key and the Turnstile key of the production profile.
eval "$(node -e "for (const [k, v] of Object.entries(require('./eas.json').build.production.env)) console.log('export ' + k + '=' + JSON.stringify(v))")"

# Sentry's build phases upload the source map and debug symbols with the token in .env.sentry-build-plugin; without
# it they would fail the build, so they skip the upload instead.
[ -f .env.sentry-build-plugin ] || [ -n "${SENTRY_AUTH_TOKEN:-}" ] || export SENTRY_DISABLE_AUTO_UPLOAD=true

xcodebuild -workspace ios/Barry.xcworkspace -scheme Barry -configuration Release -destination "platform=iOS,name=$iphone" \
  -derivedDataPath ios/build -allowProvisioningUpdates build
xcrun devicectl device install app --device "$iphone" ios/build/Build/Products/Release-iphoneos/Barry.app
