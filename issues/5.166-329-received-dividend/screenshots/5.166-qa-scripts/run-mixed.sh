#!/bin/bash
Q=/tmp/claude-0/-home-user-vaultfolio/35b35548-5942-5886-b0bd-2d4a3cbe1dd9/scratchpad/qa5166
run() { local which=$1 step=$2; (cd $Q/$which && QA_STATE=$Q/mixed2 QA_STEP=$step npx vitest run src/lib/__tests__/qa-mixed.test.ts 2>&1 | grep -E "✓|×|FAIL|AssertionError|Error:|expected|received|Tests |^\s+[-+] " | cut -c1-600 | sed "s/^/[$which $step] /"); }
run app 1-newA-create-push; run main 2-oldB-pull-edit-push; run app 3-newA-pull-repush; run main 4-oldB-pull-delete-tagged-push; run app 5-newA-pull-after-old-delete; run main 6-old-rollback-on-A; run app 7-new-redeploy-on-A; run main 8-old-import-new-backup-export; run app 9-new-import-old-backup
