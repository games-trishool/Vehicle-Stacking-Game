#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Requires ImageMagick 7. The square source is adapted from the player's image.
source_icon=public/icons/icon-512.png
magick "$source_icon" -resize 192x192 public/icons/icon-192.png
magick "$source_icon" -resize 180x180 public/icons/apple-touch-icon.png
magick "$source_icon" -resize 64x64 public/icons/favicon.png
for entry in mdpi:48:108 hdpi:72:162 xhdpi:96:216 xxhdpi:144:324 xxxhdpi:192:432; do
  IFS=: read -r density size foreground <<< "$entry"
  target="android/app/src/main/res/mipmap-$density"
  magick "$source_icon" -resize "${size}x${size}" "$target/ic_launcher.png"
  magick "$source_icon" -resize "${size}x${size}" \
    \( +clone -fill black -colorize 100 -fill white -draw "circle $((size/2)),$((size/2)) $((size/2)),0" \) \
    -alpha off -compose CopyOpacity -composite "$target/ic_launcher_round.png"
  magick "$source_icon" -resize "${foreground}x${foreground}" "$target/ic_launcher_foreground.png"
done
