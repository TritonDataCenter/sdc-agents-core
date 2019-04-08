#
# Copyright (c) 2019, Joyent, Inc.
#
# Makefile: basic Makefile for template API service
#
# This Makefile is a template for new repos. It contains only repo-specific
# logic and uses included makefiles to supply common targets (javascriptlint,
# jsstyle, restdown, etc.), which are used by other repos as well. You may well
# need to rewrite most of this file, but you shouldn't need to touch the
# included makefiles.
#
# If you find yourself adding support for new targets that could be useful for
# other projects too, you should add these to the original versions of the
# included Makefiles (in eng.git) so that other teams can use them too.
#

#
# Files
#
JS_FILES	:= $(shell find bin lib test -name '*.js')
JSL_CONF_NODE	 = tools/jsl.node.conf
JSL_FILES_NODE   = $(JS_FILES)
JSSTYLE_FILES	 = $(JS_FILES)
JSSTYLE_FLAGS    = -o indent=4,doxygen,unparenthesized-return=0

# NPM here is set to the default npm in the path. This is because we're not
# shipping a node, and we just need *an* npm to install the non-addon
# package.json dependencies for us.
#
# If there's no npm in the path or if that npm cannot install node packages,
# this will not work.
NPM := npm

BASE_IMAGE_UUID := fd2cc906-8938-11e3-beab-4359c665ac99
ENGBLD_REQUIRE := $(shell git submodule update --init deps/eng)
include ./deps/eng/tools/mk/Makefile.defs
TOP ?= $(error Unable to access eng.git submodule Makefiles.)

include ./deps/eng/tools/mk/Makefile.smf.defs

NAME		:= agents_core
RELEASE_TARBALL := $(NAME)-$(STAMP).tgz
RELEASE_MANIFEST := $(NAME)-$(STAMP).manifest
RELSTAGEDIR      := /tmp/$(NAME)-$(STAMP)
NODEUNIT	= $(TOP)/node_modules/.bin/nodeunit

#
# Repo-specific targets
#
.PHONY: all
all: $(SMF_MANIFESTS) | $(REPO_DEPS)
	$(NPM) install && $(NPM) update

CLEAN_FILES += $(TAP) ./node_modules/tap
CLEAN_FILES += $(NAME)-*.tgz $(NAME)-*.manifest

.PHONY: test
test: $(TAP)
	TAP=1 $(TAP) test/*.test.js

.PHONY: release
release: all deps $(SMF_MANIFESTS)
	@echo "Building $(RELEASE_TARBALL)"
	@mkdir -p $(RELSTAGEDIR)/$(NAME)
	cd $(TOP) && $(NPM) install
	cp -r \
    $(TOP)/bin \
    $(TOP)/lib \
    $(TOP)/bootstrap \
    $(TOP)/Makefile \
    $(TOP)/node_modules \
    $(TOP)/npm \
    $(TOP)/package.json \
    $(RELSTAGEDIR)/$(NAME)
	uuid -v4 > $(RELSTAGEDIR)/$(NAME)/image_uuid
	(cd $(RELSTAGEDIR) && $(TAR) -I pigz -cf $(TOP)/$(RELEASE_TARBALL) *)
	cat $(TOP)/manifest.tmpl | sed \
		-e "s/UUID/$$(cat $(RELSTAGEDIR)/$(NAME)/image_uuid)/" \
		-e "s/NAME/$$(json name < $(TOP)/package.json)/" \
		-e "s/VERSION/$$(json version < $(TOP)/package.json)/" \
		-e "s/DESCRIPTION/$$(json description < $(TOP)/package.json)/" \
		-e "s/BUILDSTAMP/$(STAMP)/" \
		-e "s/SIZE/$$(stat --printf="%s" $(TOP)/$(RELEASE_TARBALL))/" \
		-e "s/SHA/$$(openssl sha1 $(TOP)/$(RELEASE_TARBALL) \
		    | cut -d ' ' -f2)/" \
		> $(TOP)/$(RELEASE_MANIFEST)
	# This next line is intended to error if there are any node add-ons in the
	# RELSTAGEDIR since we are using the build zone's npm/node. If node add-ons
	# are added, we'll need to switch to using sdcnode again and remove this
	# guard.
	@if find $(RELSTAGEDIR) -name '*.node' | grep '.*'; then
	    echo "error: node add-ons are not supported without sdcnode."
	fi
	@rm -rf $(RELSTAGEDIR)

.PHONY: publish
publish: release
	mkdir -p $(ENGBLD_BITS_DIR)/$(NAME)
	cp $(TOP)/$(RELEASE_TARBALL) $(ENGBLD_BITS_DIR)/$(NAME)/$(RELEASE_TARBALL)
	cp $(TOP)/$(RELEASE_MANIFEST) $(ENGBLD_BITS_DIR)/$(NAME)/$(RELEASE_MANIFEST)

.PHONY: dumpvar
dumpvar:
	@if [[ -z "$(VAR)" ]]; then \
		echo "error: set 'VAR' to dump a var"; \
		exit 1; \
	fi
	@echo "$(VAR) is '$($(VAR))'"


include ./deps/eng/tools/mk/Makefile.deps
include ./deps/eng/tools/mk/Makefile.smf.targ
include ./deps/eng/tools/mk/Makefile.targ
