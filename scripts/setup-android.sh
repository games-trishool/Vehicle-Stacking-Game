#!/usr/bin/env bash
set -euo pipefail
# Keep tools and caches outside the checkout, so onboarding never alters source.
sdk_root=/workspace/.android-sdk
mkdir -p "$sdk_root/cmdline-tools"
if [ ! -x "$sdk_root/cmdline-tools/19.0/bin/sdkmanager" ]; then
  archive=$(mktemp /tmp/stackline-sdk.XXXXXX.zip)
  trap 'rm -f "$archive"' EXIT
  curl --fail --location --retry 2 --proto '=https' --tlsv1.2 \
    https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip \
    --output "$archive"
  # Official Google repository2-1.xml checksum for this exact artifact.
  printf '%s  %s\n' 5fdcc763663eefb86a5b8879697aa6088b041e70 "$archive" | sha1sum --check --status
  unzip -q "$archive" -d "$sdk_root/cmdline-tools"
  mv "$sdk_root/cmdline-tools/cmdline-tools" "$sdk_root/cmdline-tools/19.0"
fi
export ANDROID_USER_HOME=/workspace/.android-user-home
export ANDROID_HOME="$sdk_root"
export ANDROID_SDK_ROOT="$sdk_root"
python3 - <<'PY'
import os, subprocess
sdk=os.environ['ANDROID_HOME']
manager=sdk+'/cmdline-tools/19.0/bin/sdkmanager'
subprocess.run([manager,'--sdk_root='+sdk,'--licenses'],input='y\n'*100,text=True,check=True)
subprocess.run([manager,'--sdk_root='+sdk,'platform-tools','platforms;android-35','build-tools;35.0.0'],input='y\n'*100,text=True,check=True)
PY
