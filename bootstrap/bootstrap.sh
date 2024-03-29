#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

#
# Copyright (c) 2014, Joyent, Inc.
# Copyright 2023 MNX Cloud, Inc.
#

# Set up an NPM environment where we will install all the agents.

PREFIX=$1
BOOTSTRAP_DIR=$(cd `dirname $0`/.. && pwd)
PATH=/bin:/usr/bin:/usr/sbin:/sbin

set -e
set -o xtrace

echo "Installing to $PREFIX"
if [ -z "$PREFIX" ]; then
  echo Must specify directory to bootstrap into
  exit 1
fi

if [ ! -d "$PREFIX" ]; then
  mkdir -p $PREFIX
fi

PREFIX=$(cd $PREFIX && pwd) # absolute path
NODE_MODULES=$PREFIX/lib/node_modules
BIN_DIR=$PREFIX/bin
DB_DIR=$PREFIX/db
ETC_DIR=$PREFIX/etc
SMFDIR=$PREFIX/smf
PATH="${BOOTSTRAP_DIR}/local/bin:${PATH}"; export PATH

mkdir -p "$BIN_DIR"      \
         "$ETC_DIR"      \
         "$DB_DIR"       \
         "$NODE_MODULES" \
         "$SMFDIR"       \

NODE="/usr/node/bin/node"

if [ ! -e "$NODE" ]; then
  NODE=`which node`
fi

$NODE $BOOTSTRAP_DIR/bin/apm.js install $BOOTSTRAP_DIR

exit 0;
