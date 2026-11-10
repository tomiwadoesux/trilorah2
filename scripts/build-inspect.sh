#!/bin/sh
# Build trilorah-inspect (controller/macos/inspect.swift) into controller/bin.
# Needs Xcode's Swift toolchain. -swift-version 5 keeps the Accessibility
# C APIs free of Swift 6's concurrency diagnostics; the tool is single-threaded.
set -e
cd "$(dirname "$0")/.."
mkdir -p controller/bin
swiftc -O -swift-version 5 \
  -framework AppKit -framework ApplicationServices \
  -o controller/bin/trilorah-inspect \
  controller/macos/inspect.swift
echo "built controller/bin/trilorah-inspect"
