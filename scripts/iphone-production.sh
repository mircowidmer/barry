#!/usr/bin/env bash
# Builds the production app with a free Apple team and installs it on the iPhone named BARRY_IPHONE, connected and
# unlocked. docs/iphone.md describes the steps.
set -euo pipefail

iphone="${BARRY_IPHONE:-Mirone}"
export LANG=en_US.UTF-8
export APP_VARIANT=production BARRY_WITHOUT_PUSH=1

# With ccache installed, pod install wraps clang in React Native's ccache script, so the C, C++ and Objective-C of the
# native modules compile once and come from the cache after every later prebuild. The wrapper reads CCACHE_BINARY from
# the environment, not from the build settings.
if ccache="$(command -v ccache)"; then
  export USE_CCACHE=1 CCACHE_BINARY="$ccache"
fi

# ios/ is regenerated only when what goes into it changed since this script last generated it: the native fingerprint
# of the production variant, the German permission strings and whether ccache is on. A development prebuild in between
# replaces ios/ and its marker, and changes the bundle identifier.
marker=ios/.barry-production
inputs="$(node_modules/.bin/fingerprint fingerprint:generate --platform ios | node -p 'JSON.parse(require("fs").readFileSync(0)).hash')"
inputs="$inputs $(cat locales/*.json | shasum | cut -c1-40) ccache=${USE_CCACHE:-0}"
if [ "$(cat "$marker" 2>/dev/null)" = "$inputs" ] &&
  grep -q 'PRODUCT_BUNDLE_IDENTIFIER = support.barry;' ios/Barry.xcodeproj/project.pbxproj; then
  echo "ios/ is current for the production variant, skipping prebuild"
else
  npx expo prebuild --clean --platform ios
  echo "$inputs" > "$marker"
fi

# The hosted Supabase URL, the publishable key and the Turnstile key of the production profile.
eval "$(node -e "for (const [k, v] of Object.entries(require('./eas.json').build.production.env)) console.log('export ' + k + '=' + JSON.stringify(v))")"

# Sentry's build phases upload the source map and debug symbols with the token in .env.sentry-build-plugin; without
# it they would fail the build, so they skip the upload instead.
[ -f .env.sentry-build-plugin ] || [ -n "${SENTRY_AUTH_TOKEN:-}" ] || export SENTRY_DISABLE_AUTO_UPLOAD=true

xcodebuild -workspace ios/Barry.xcworkspace -scheme Barry -configuration Release -destination "platform=iOS,name=$iphone" \
  -derivedDataPath ios/build -allowProvisioningUpdates build
xcrun devicectl device install app --device "$iphone" ios/build/Build/Products/Release-iphoneos/Barry.app
