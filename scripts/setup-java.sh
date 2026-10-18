#!/usr/bin/env bash
set -euo pipefail
# Eclipse Temurin 21 LTS, pinned to an official release and its SHA-256.
jdk_destination=/workspace/.stackline-cache/temurin21
if [ ! -x "$jdk_destination/bin/javac" ]; then
  mkdir -p "$jdk_destination"
  archive=$(mktemp /tmp/stackline-jdk.XXXXXX.tar.gz)
  trap 'rm -f "$archive"' EXIT
  curl --fail --location --retry 2 --proto '=https' --tlsv1.2 \
    'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_x64_linux_hotspot_21.0.12.1_1.tar.gz' \
    --output "$archive"
  expected_checksum=ce79869e1307ed8ee1e2baa86a412b1eb5b75d10a01006d788a6f968bcfaee94
  printf '%s  %s\n' "$expected_checksum" "$archive" | sha256sum --check --status
  tar -xzf "$archive" --strip-components=1 -C "$jdk_destination"
fi
"$jdk_destination/bin/java" -version
"$jdk_destination/bin/javac" -version
