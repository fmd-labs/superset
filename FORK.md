<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Fork divergences

This repository is a fork of [apache/superset](https://github.com/apache/superset) (Apache-2.0). This file lists
every **divergence**: each change that makes this fork differ from the upstream release it is based on. A pull
request that adds, changes or removes a divergence updates this file in the same pull request.

## Base

- **Upstream:** [apache/superset](https://github.com/apache/superset)
- **Upstream tag:** `6.1.0`
- **Merge base:** `c83fb2bb1dcfac41ac51bcebd82471f4a7180d18` (the commit the `6.1.0` tag names)
- **Upstream image of the merge base:**
  `apache/superset:6.1.0@sha256:16b50bbef6648912a79e3293d418fefa743ce555d36c5af6b85d859119ed7f88` (the `lean`
  image, as rebuilt by upstream on 2026-09-07; see **Roll back to an upstream image**)
- **Fork created:** 2026-11-09. The integration branch is `fork`; the fork has no `master`.

The fork follows upstream **releases**, not `master`: its base is a release tag, and moving to a newer release is a
procedure of its own (see **Move to a new upstream release**). A release is what an operator runs, and a fork image
is then always one upstream release plus the divergences below.

## Policy

- **The metadata database stays upstream's.** The fork adds, changes and removes no migration under
  `superset/migrations/`, so the upstream image of the same release always runs on a metadata database the fork
  image used (see **Roll back to an upstream image**). The divergence audit (D02) enforces it. What the fork stores
  lives in what upstream already stores as JSON (chart `params`, dashboard `json_metadata`) under keys of its own,
  which upstream ignores.
- **Generic and reusable.** The fork is a general-purpose Superset: every divergence is useful to any operator, a
  feature that changes behavior is configurable and defaults to upstream's (fixes of upstream bugs apply as they
  are), and none names a particular deployment, product or customer, in code, comments, docs, commit messages and
  pull requests alike.
- **Upstream behavior by default.** A chart, dashboard or setting that does not use a divergence behaves exactly as
  upstream.
- **Upstream first where it fits.** Divergences that are useful to every Superset deployment are candidates for an
  upstream proposal; each records its upstream status, and a divergence is removed once an upstream release ships
  it.
- **Upstream conventions.** Code the fork adds follows upstream's: the Apache license header, prettier, oxlint and
  the custom frontend rules, tests next to the code, and `pre-commit run --all-files` clean.

## Format

Each divergence is a `### Dnn — title` section below. IDs are never reused. Each section has these bullets:

- **Since:** date the divergence was first merged into the fork.
- **Kind:** `feature`, `fix`, `refactor`, `test`, `docs` or `ci`.
- **Upstream:** `fork-only`, `not proposed`, or a link to the upstream pull request or issue with its state.
- **Files:** one backticked path per nested bullet: an exact path, or a directory prefix ending in `/` for a directory
  the fork adds (changes inside upstream directories are listed file by file). Deleted files and the old path of a
  renamed file are listed too. A path may appear under more than one divergence.
- **What**, **Why** (optional) and **Remove when**.

The divergence audit (D02) reads the **Files** lists and the workflow inventory mechanically; keep them in this format.
It skips HTML comments and fenced code blocks.

## Divergences

### D01 — Fork notice and divergence log

- **Since:** 2026-11-09
- **Kind:** docs
- **Upstream:** fork-only
- **Files:**
  - `README.md`
  - `FORK.md`
  - `AGENTS.md`
- **What:** a notice at the top of `README.md` linking to this file; this file; a section in `AGENTS.md` (which
  `CLAUDE.md`, `GEMINI.md` and `GPT.md` link to) that every divergence is recorded here and follows the **Policy**
  above.
- **Remove when:** never (fork-only).

### D02 — Fork checks in CI

- **Since:** 2026-11-09
- **Kind:** ci
- **Upstream:** fork-only
- **Files:**
  - `.github/workflows/fork-checks.yml`
  - `.github/fork/`
- **What:** the `Fork checks` workflow runs on every push and pull request to `fork`. Its **Divergence audit** job
  (`node .github/fork/audit-divergence.mjs`) checks that:
  - the merge base with the upstream tag named under **Base** is the one recorded there;
  - every file that differs from the upstream tag named under **Base** is listed under a divergence, every listed
    path still differs, and a directory entry only names a directory the fork adds;
  - nothing under `superset/migrations/` differs (see **Policy**);
  - a line of a **Files** list is one backticked path;
  - every workflow file is in the workflow inventory, with the state it has in this repository's Actions settings
    (compared in CI only).

  Run it locally with `FORK_AUDIT_UPSTREAM_REF=6.1.0 node .github/fork/audit-divergence.mjs --working-tree` after
  `git fetch upstream tag 6.1.0`.
- **Why:** the fork's tooling lives in `.github/fork/`, where upstream's change detector (which runs the Python
  suites for any change under `scripts/`) and its license check (which skips hidden directories) leave it alone.
- **Remove when:** never (fork-only).

### D03 — Fork image releases

- **Since:** 2026-11-09
- **Kind:** ci
- **Upstream:** fork-only
- **Files:**
  - `.github/workflows/fork-release.yml`
  - `.github/fork/registry.mjs`
- **What:** the `Fork release` workflow publishes this fork's image to `ghcr.io/fmd-labs/superset`, in place of
  upstream's `docker.yml` and `tag-release.yml` (see D04). It builds upstream's release image: the `lean` target of
  the `Dockerfile`, with `PY_VER=3.10-slim-bookworm` (the base upstream's release image is built on; the Dockerfile's
  default differs) and the Dockerfile's defaults otherwise (no translations, no browsers, not dev mode), natively on
  amd64 and arm64. A candidate is built only from a commit on `fork` on which the checks that branch protection
  requires have passed, and its smoke test requires the image to migrate a fresh metadata database, create an admin,
  answer `/health`, its login and API, serve the frontend this fork built (D05's code is in its bundle), and keep
  running. `.github/fork/registry.mjs` looks up image digests and tells a missing tag apart from a failed request.
  See **Releases** for the procedure.
- **Why:** a release is built once, smoke-tested, verified by hand, and promoted unchanged. Only the image the release
  tag names by digest can be promoted, and only if a successful candidate run of that commit and version published it:
  the run records the digest it published, and the promotion requires both that record and the candidate tag to name
  the verified digest. Candidate tags are written once, the workflow never replaces an existing release image, and no
  `latest` or floating tags are published.
- **Remove when:** never (fork-only).

### D04 — Upstream CI in the fork

- **Since:** 2026-11-09
- **Kind:** ci
- **Upstream:** fork-only
- **Files:**
  - `.github/workflows/bump-python-package.yml`
  - `.github/workflows/cancel_duplicates.yml`
  - `.github/workflows/check_db_migration_confict.yml`
  - `.github/workflows/claude.yml`
  - `.github/workflows/codeql-analysis.yml`
  - `.github/workflows/docker.yml`
  - `.github/workflows/ecs-task-definition.json`
  - `.github/workflows/embedded-sdk-release.yml`
  - `.github/workflows/ephemeral-env-pr-close.yml`
  - `.github/workflows/ephemeral-env.yml`
  - `.github/workflows/generate-FOSSA-report.yml`
  - `.github/workflows/issue_creation.yml`
  - `.github/workflows/labeler.yml`
  - `.github/workflows/latest-release-tag.yml`
  - `.github/workflows/pr-lint.yml`
  - `.github/workflows/release.yml`
  - `.github/workflows/showtime-cleanup.yml`
  - `.github/workflows/showtime-trigger.yml`
  - `.github/workflows/superset-docs-deploy.yml`
  - `.github/workflows/superset-docs-verify.yml`
  - `.github/workflows/superset-helm-release.yml`
  - `.github/workflows/superset-playwright.yml`
  - `.github/workflows/superset-python-presto-hive.yml`
  - `.github/workflows/supersetbot.yml`
  - `.github/workflows/tag-release.yml`
  - `.github/workflows/tech-debt.yml`
  - `.github/workflows/welcome-new-users.yml`
  - `.github/workflows/check-python-deps.yml`
  - `.github/workflows/dependency-review.yml`
  - `.github/workflows/github-action-validator.yml`
  - `.github/workflows/pre-commit.yml`
  - `.github/workflows/superset-app-cli.yml`
  - `.github/workflows/superset-e2e.yml`
  - `.github/workflows/superset-frontend.yml`
  - `.github/workflows/superset-python-integrationtest.yml`
  - `.github/workflows/superset-python-unittest.yml`
  - `.github/workflows/superset-translations.yml`
- **What:**
  - **Removed:** upstream's workflows that publish (Docker Hub images, npm packages, the Helm chart, the docs site,
    release tags), deploy ephemeral environments, run upstream's bots and community automation (labels, welcome
    comments, the Claude and SupersetBot comment commands, PR title lint, tech-debt sheets, FOSSA), run nightly or on
    `pull_request_target` with secrets, or give no signal here (the migration-conflict check, which finds nothing on
    pull requests; the experimental Playwright suite, which upstream runs in shadow mode; the Presto and Hive suite;
    CodeQL, which GitHub's default setup covers). `ecs-task-definition.json` only served the ephemeral environments.
    A removed workflow cannot run from the default branch, whatever its trigger.
  - **Kept:** the frontend build, lint, type check and unit tests, pre-commit, the Python unit and integration suites,
    E2E (Cypress and the required Playwright tests), translations, the app CLI, the dependency and license checks and
    the action validator. They run on pushes to `fork` as well as on pull requests, so a merged commit carries their
    checks (the release workflow requires them, D03). Workflows that only run for paths the fork never changes (the
    embedded SDK, the websocket server, the Helm chart lint, the extensions CLI) and the hold-label check are kept
    unchanged.
  - `superset-frontend.yml` and `superset-e2e.yml` end with one job each, `frontend-ci` and `e2e-ci`, that passes when
    every other job passed or was skipped: the frontend jobs are skipped as a whole when the frontend is unchanged,
    which leaves the names of their matrix jobs unreported, so branch protection requires these two instead.
  - `pre-commit.yml` installs `helm-docs` with Go instead of Homebrew, backported from upstream's `6.1` branch
    (`74c4ac868`, apache/superset#42113): the Homebrew step fails on current runners.
- **Remove when:** never (fork-only). The backport goes when the base contains it (6.1.1 or later).

### D05 — Viewer time grain switch on dashboard charts

- **Since:** 2026-11-09
- **Kind:** feature
- **Upstream:** not proposed
- **Files:**
  - `superset-frontend/packages/superset-ui-chart-controls/src/utils/timeGrainSwitch.ts`
  - `superset-frontend/packages/superset-ui-chart-controls/src/utils/index.ts`
  - `superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/sharedControls.tsx`
  - `superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/components/TimeGrainPeriodsControl.tsx`
  - `superset-frontend/packages/superset-ui-chart-controls/src/shared-controls/components/index.tsx`
  - `superset-frontend/packages/superset-ui-chart-controls/src/sections/echartsTimeSeriesQuery.tsx`
  - `superset-frontend/packages/superset-ui-chart-controls/test/utils/timeGrainSwitch.test.ts`
  - `superset-frontend/packages/superset-ui-chart-controls/test/shared-controls/components/TimeGrainPeriodsControl.test.tsx`
  - `superset-frontend/plugins/plugin-chart-echarts/src/MixedTimeseries/controlPanel.tsx`
  - `superset-frontend/src/dashboard/components/SliceHeader/TimeGrainSwitch.tsx`
  - `superset-frontend/src/dashboard/components/SliceHeader/TimeGrainSwitch.test.tsx`
  - `superset-frontend/src/dashboard/components/SliceHeader/index.tsx`
  - `superset-frontend/src/dashboard/components/gridComponents/Chart/Chart.tsx`
  - `superset-frontend/src/dashboard/components/gridComponents/Chart/Chart.test.tsx`
  - `superset-frontend/src/dashboard/actions/chartTimeGrains.ts`
  - `superset-frontend/src/dashboard/actions/chartTimeGrains.test.ts`
  - `superset-frontend/src/dashboard/util/charts/timeGrainSwitchUrl.ts`
  - `superset-frontend/src/dashboard/util/charts/timeGrainSwitchUrl.test.ts`
  - `superset-frontend/src/dashboard/util/extractUrlParams.ts`
  - `superset-frontend/src/dashboard/util/extractUrlParams.test.ts`
  - `superset-frontend/src/dashboard/containers/DashboardPage.tsx`
  - `superset-frontend/src/dashboard/components/nativeFilters/FilterBar/index.tsx`
  - `superset-frontend/src/explore/exploreUtils/index.ts`
  - `superset-frontend/src/explore/exploreUtils/exploreUtils.test.tsx`
  - `superset-frontend/src/logger/LogUtils.ts`
- **What:** a chart can offer dashboard viewers a choice of time grains in its header, without anyone editing the
  chart. Upstream applies a time grain to a dashboard only through a filter in the filter bar, for every chart in its
  scope.
  - **Authoring:** two controls under **Time grain** in the ECharts time series charts (line, bar, area, scatter,
    smooth line, step) and the mixed time series chart. **Viewer time grains** (`time_grain_options`) lists the grains
    a viewer can switch to, from the dataset's own (any the database offers, `TIME_GRAIN_ADDONS` included); empty, the
    default, shows no switch. **Periods per viewer time grain** (`time_grain_periods`) sets how many periods of each of
    them the chart shows, the current one included: 12 for the week shows the last 12 weeks. The chart's own time
    grain and its time range stay the default; a chart without a grain of its own has no default to return to and
    shows no switch. An anchored grain (a week starting on Sunday) can be offered but has no periods.
  - **Viewing:** the header shows one button per grain (D, W, 2W, M, Q, …, with the grain's name and its span as
    tooltip), or a dropdown when the buttons would crowd the title, and the dates the chart covers when there is room
    (in Superset's UI language). A choice re-runs that chart only: it is kept in the chart's own state on the dashboard
    (`ownState.selectedTimeGrain`), which upstream's dashboard already re-queries a chart for, and choosing the default
    grain clears it. The chart's renderer gets its own state without the choice, so it keeps showing the current data
    until the new query returns.
  - **Query:** the chosen grain replaces the chart's grain, a dashboard time grain filter's included, and the grain an
    adhoc x-axis carries, so the query and the axis formatting agree; the chart's resampling, tied to its saved grain,
    is dropped. When periods are configured for it, the chart's time range becomes those periods, through the end of
    the current day (sub-day grains: of the current hour, minute or second), as `DATETRUNC`/`DATEADD` on the server's
    today: a range ending "now" would leave today out of a date column. Quarters use the parser's `quarter` unit; other
    multi-unit grains are aligned like their SQL (two weeks to Monday 1970-01-05), and that window is recomputed for
    every query, so a refresh of a dashboard left open does not drift. Weeks are taken to start on Monday, as on
    PostgreSQL and ClickHouse; an engine whose weeks start on Sunday shows a partial first week. The periods replace
    the chart's time range filter, and apply only when the chart's TEMPORAL_RANGE filters are all on its x-axis
    column: otherwise the chart keeps its window and the tooltips name no periods. A dashboard time range filter that
    applies to the chart keeps precedence over the periods.
  - **Sharing:** choices are kept in the dashboard URL (`chart_time_grains=<chart id>:<grain>,…`, percent-encoded in
    the address bar) and applied in one batch with the dashboard's hydration, for the charts on the dashboard that
    offer that grain, so the charts first query with them; a permalink keeps them, as it keeps the dashboard's URL
    parameters. The parameter is reserved, so it does not reach the charts' `url_params` (which would change their
    cache keys), and the native filter bar now reads the URL's other parameters after its key request, so a choice
    made meanwhile is not dropped. Exports from the chart menu use the grain on screen.
  - The `change_dashboard_chart_time_grain` log event records each choice.
- **Why:** with a fixed grain per chart, a dashboard needs a daily and a weekly copy of a chart, or a grain filter
  that changes every chart at once.
- **Known limits:** reports, alerts and thumbnails render the chart's default grain. Opening the chart in Explore from
  the dashboard shows the saved grain.
- **Remove when:** upstream ships a per-chart time grain choice for dashboard viewers.

### D06 — Dashboard datasets list their time grains by duration

- **Since:** 2026-11-09
- **Kind:** fix
- **Upstream:** not proposed
- **Files:**
  - `superset/connectors/sqla/models.py`
  - `tests/unit_tests/connectors/sqla/models_test.py`
- **What:** `SqlaTable.time_grain_sqla` gives each grain's ISO 8601 duration as a plain string. Engines that key their
  grains by `TimeGrain` member (PostgreSQL among them) gave the member, which the dashboard datasets API
  (`/api/v1/dashboard/<id>/datasets`, a marshmallow `Str` field) wrote as `"TimeGrain.DAY"` instead of `"P1D"`; the
  dataset and Explore APIs, which write JSON, were not affected. D05 names the grains from that list.
- **Remove when:** upstream writes the durations in the dashboard datasets API.

### D07 — Axis labels of added day-or-longer grains

- **Since:** 2026-11-09
- **Kind:** fix
- **Upstream:** not proposed
- **Files:**
  - `superset-frontend/plugins/plugin-chart-echarts/src/utils/formatters.ts`
  - `superset-frontend/plugins/plugin-chart-echarts/test/utils/formatters.test.ts`
- **What:** the ECharts time axis formatter sets the dates of every day-or-longer grain (`P<n>D`, `P<n>W`, `P<n>M`,
  `P<n>Y`) without a branch of its own to midnight UTC, as it does for the built-in ones. A grain from
  `TIME_GRAIN_ADDONS`, such as `P2W`, got ticks labelled with seconds (`:40s`).
- **Remove when:** upstream formats added grains the same way.

## Repository settings

Settings that live in GitHub rather than in files:

- `fork` is the default branch and is protected for everyone, administrators included: changes land through pull
  requests, and force pushes and deletion are blocked.
- Pull requests to `fork` merge only when `Divergence audit`, `frontend-ci`, `e2e-ci`, `pre-commit (current)`,
  `unit-tests (current)`, `test-postgres (current)` and `License Check` pass. The `Fork release` workflow requires the
  same checks on a candidate's commit, except `License Check`, which upstream runs on pull requests only (`Require
  green CI`); keep both lists in step.
- Tags matching `*-fork.*` cannot be moved or deleted, by anyone (ruleset "Immutable fork release tags", no bypass),
  and only administrators can create them (ruleset "Only admins create fork release tags"), since pushing one
  promotes a release.
- Merge methods: squash for fork changes, merge commits for moves to a new upstream release; rebase merging is off.
- Workflow permissions are read-only by default, and workflows from outside contributors need approval.
- The `superset` container package is public, so deployments pull it anonymously (see **Releases**).

### Workflow inventory

Every file in `.github/workflows/` must be listed here with its state in this fork's Actions settings (the divergence
audit enforces both), so a workflow added by an upstream release cannot start running in this fork unnoticed.

| Workflow                              | Origin     | State in this fork |
| ------------------------------------- | ---------- | ------------------ |
| `check-python-deps.yml`               | upstream   | enabled            |
| `dependency-review.yml`               | upstream   | enabled            |
| `embedded-sdk-test.yml`               | upstream   | enabled            |
| `github-action-validator.yml`         | upstream   | enabled            |
| `license-check.yml`                   | upstream   | enabled            |
| `no-hold-label.yml`                   | upstream   | enabled            |
| `pre-commit.yml`                      | upstream   | enabled            |
| `superset-app-cli.yml`                | upstream   | enabled            |
| `superset-e2e.yml`                    | upstream   | enabled            |
| `superset-extensions-cli.yml`         | upstream   | enabled            |
| `superset-frontend.yml`               | upstream   | enabled            |
| `superset-helm-lint.yml`              | upstream   | enabled            |
| `superset-python-integrationtest.yml` | upstream   | enabled            |
| `superset-python-unittest.yml`        | upstream   | enabled            |
| `superset-translations.yml`           | upstream   | enabled            |
| `superset-websocket.yml`              | upstream   | enabled            |
| `fork-checks.yml`                     | fork (D02) | enabled            |
| `fork-release.yml`                    | fork (D03) | enabled            |

## Releases

| Fork tag       | Upstream base           | Image                                                                                               | Divergences | Notes                                                                          |
| -------------- | ----------------------- | --------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| `6.1.0-fork.1` | `c83fb2b` (tag `6.1.0`) | `ghcr.io/fmd-labs/superset@sha256:ee804ae1665ace84fd043a1b21767435623c2386550e0b62842088369cb78dec` | D01–D07     | First release (#1, #2), of `10b010a`; candidate `sha-10b010a-run.42634390023`. |

Fork releases are tagged `<upstream version>-fork.<n>`, for example `6.1.0-fork.1`, like upstream's tags without a
`v`. `<upstream version>` is the upstream tag named in **Base**, and `<n>` counts fork releases on that upstream
version. A fork tag is a SemVer pre-release, so it sorts below the upstream release of the same number; that is
intended, as no floating tags (`latest`, `6.1`) are published. The image tag is the git tag:
`ghcr.io/fmd-labs/superset:6.1.0-fork.1`.

To release:

1. Wait for CI on `fork` after the last pull request of the release is merged: a candidate is built only from a commit
   whose required checks passed.
2. Run the `Fork release` workflow on `fork` with the version:
   `gh workflow run fork-release.yml --ref fork -f version=6.1.0-fork.1`. The run is named `Candidate 6.1.0-fork.1`.
   It builds the amd64 and arm64 images once, publishes them only under a candidate tag unique to the run,
   `sha-<first 7 characters of the commit>-run.<run id>` (with the version in the image labels), records the digest
   it published with the run (artifact `candidate-digest`, kept for the repository's default 90 days, which is how long
   a candidate can still be promoted), and smoke-tests exactly that image on both architectures.
   The run summary lists the candidate by tag and digest, and the full commit. A candidate tag is written once:
   re-running a run keeps the candidate it published and smoke-tests that image again, and building again takes a new
   run.
3. The first candidate run creates the `superset` package in this organization's container registry as private: make
   it public in the package settings (**Change visibility**) before promoting.
4. Verify the candidate image, by digest, end to end.
5. Once the candidate run has succeeded, tag its commit, naming the commit explicitly and the verified digest in the
   message, and push only that tag:
   `git tag -a 6.1.0-fork.1 <commit> -m "6.1.0-fork.1" -m "Image: ghcr.io/fmd-labs/superset@sha256:<digest>"`, then
   `git push origin 6.1.0-fork.1` (never `git push --tags`). A pushed tag cannot be moved, so check it first:
   `git tag -l --format='%(contents)' 6.1.0-fork.1` and
   `docker buildx imagetools inspect ghcr.io/fmd-labs/superset@sha256:<digest>` (a local tag can still be deleted with
   `git tag -d`). The tag run promotes exactly that digest, provided a successful `Candidate 6.1.0-fork.1` run of that
   commit on `fork` published it (as that run recorded, and as its candidate tag still names), without rebuilding it.
   It checks that the image can be pulled anonymously before creating anything, never replaces an existing release
   image, and treats a release tag that already points to the digest as done, so a failed run can be re-run.
6. Record the release in the table above (tag, upstream base, image digest, divergences) in a follow-up pull request.

## Procedures

### Set up a clone

```sh
git clone https://github.com/fmd-labs/superset.git && cd superset
git remote add --no-tags upstream https://github.com/apache/superset.git
git remote set-url --push upstream DISABLED
git fetch upstream tag 6.1.0
```

`--no-tags` keeps upstream's tags out of the clone; fetch the release tags you need explicitly.

### Move to a new upstream release

Upstream cuts each release on a release branch with cherry-picks, so a release is not a descendant of the previous
one, and merging it into `fork` would conflict with every backport. The move rebuilds the divergences on the new
release instead, and records both histories:

1. `git fetch upstream tag <version>`, then create `sync/upstream-<version>` from the tag.
2. Re-apply each divergence on top of it (`git cherry-pick` of the fork's commits since the last move, or by hand),
   keeping upstream's change where they conflict. Drop a divergence only on purpose, and remove its section in the
   same pull request. Divergences that the new release ships are removed.
3. Review every change under `.github/workflows/`: workflows added upstream run in this fork automatically. A new
   workflow the fork does not run is removed in the same pull request (D04); one it runs is added to the workflow
   inventory.
4. Record `fork` as a parent without taking any of its content: `git merge -s ours origin/fork`. Then update
   **Base** (tag, merge base, upstream image) and the upstream status of each divergence, and run the divergence
   audit against the new tag.
5. Open a pull request and merge it with a merge commit; squashing it loses the history it records. Moving to a newer
   release can bring metadata migrations: they apply when the new fork image starts, as with upstream, and a rollback
   then goes to the upstream image of the new release.

### Roll back to an upstream image

Roll back only to the upstream image of the release named in **Base**, or to a newer upstream release: an older image
can lack migrations the metadata database has already applied. Pin it by digest. Since the fork changes no migration
(see **Policy**), the upstream image of the same release runs on the fork's metadata database as it is.
Divergence-specific caveats are listed under **Rollback notes**.

## Rollback notes

- **D05:** an upstream image ignores `time_grain_options` and `time_grain_periods`: charts show their default grain
  and no switch, and `chart_time_grains` in a URL does nothing (it then reaches the charts' `url_params`, as any other
  parameter). A chart saved in an upstream image's Explore loses both keys, since Explore saves only the controls it
  knows.
