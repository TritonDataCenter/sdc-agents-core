<!--
    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
-->

<!--
    Copyright (c) 2014, Joyent, Inc.
-->

# Agents Core

Repository: <git@github.com:joyent/sdc-agents-core.git>
Browsing: <https://mo.joyent.com/agents_core>
Who: Orlando Vazquez
Docs: <https://mo.joyent.com/docs/agents_core>
Tickets/bugs: <https://devhub.joyent.com/jira/browse/AGENT>


# Overview

This repo contains the necessary parts to bootstrap an agents installation onto
a SmartDataCenter node.

# Repository

    deps/           Git submodules and/or commited 3rd-party deps should go
                    here. See "node_modules/" for node.js deps.
    docs/           Project docs (restdown)
    lib/            Source files.
    node_modules/   Node.js deps, either populated at build time or commited.
                    See Managing Dependencies.
    pkg/            Package lifecycle scripts
    smf/manifests   SMF manifests
    smf/methods     SMF method scripts
    test/           Test suite (using node-tap)
    tools/          Miscellaneous dev/upgrade/deployment tools and data.
    Makefile
    package.json    npm module info (holds the project version)
    README.md


# Development

    git clone git@github.com:joyent/sdc-agents-core.git
    cd sdc-agents-core
    git submodule update --init
