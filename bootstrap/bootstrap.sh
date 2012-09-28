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
         "$MANROOT_DIR"  \
         "$SMFDIR"       \

NODE="/usr/node/bin/node"

if [ ! -e "$NODE" ]; then
  NODE=`which node`
fi

$NODE $BOOTSTRAP_DIR/bin/apm.js install $BOOTSTRAP_DIR

exit 0;
