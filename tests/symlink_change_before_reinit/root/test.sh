#!/bin/bash
# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

# A change to a global declaration reinits the server, which crawls again after a symlink has
# changed target. A recheck first resolves through the old target, which a server started from
# saved state hasn't crawled.

# Links $2 to $1, which is relative to the directory containing $2. On Windows, MSYS and Cygwin
# create a native symlink rather than a copy.
link() {
  mkdir -p "$(dirname "$2")"
  MSYS=winsymlinks:nativestrict CYGWIN=winsymlinks:nativestrict ln -s "$1" "$2"
}

link ../outside dep
start_flow .
echo '//' >> foo.js
assert_ok "$FLOW" force-recheck --no-auto-start foo.js

rm dep
link ../other dep
echo 'declare var g: number;' > globals.d.ts
assert_ok "$FLOW" force-recheck --no-auto-start globals.d.ts
assert_errors "$FLOW" status --no-auto-start .
assert_ok "$FLOW" stop .
