#!/usr/bin/env bash
# Runs supabase/setup.sql twice against a throwaway local database and then
# the security/business-rule tests in dev/test.sql.
# Needs a local Postgres 15+ with btree_gist; set PGHOST/PGPORT/PGUSER as usual.
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"
cd "$(dirname "$0")/.."
DB="${TEST_DB:-ferieboliger_test}"
dropdb --if-exists "$DB" >/dev/null
createdb "$DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f dev/supabase-stub.sql >/dev/null
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/setup.sql >/dev/null 2>&1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/setup.sql >/dev/null 2>&1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f dev/test.sql 2>&1 | sed 's/^psql:[^ ]* WARNING:  //'
