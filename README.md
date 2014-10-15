<!--
    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
-->

<!--
    Copyright (c) 2014, Joyent, Inc.
-->

# SDC Agents Core

This repository is part of the SmartDataCenter (SDC) project. For
contribution guidelines, issues, and general documentation, visit the
[main SDC project](http://github.com/joyent/sdc).

SDC agents core bootstraps an agents installation onto a SmartDataCenter
headnode or compute nodes.

## Code Layout

    deps/           Git submodules and/or commited 3rd-party deps should go
                    here. See "node_modules/" for node.js deps.
    lib/            Source files.
    node_modules/   Node.js deps, either populated at build time or committed.
                    See Managing Dependencies.
    pkg/            Package lifecycle scripts
    test/           Test suite (using node-tap)
    tools/          Miscellaneous dev/upgrade/deployment tools and data.
    Makefile
    package.json    npm module info (holds the project version)
    README.md


## Development

    git clone git@github.com:joyent/sdc-agents-core.git
    cd sdc-agents-core
    git submodule update --init


## License

SDC is licensed under the
[Mozilla Public License version 2.0](http://mozilla.org/MPL/2.0/).
