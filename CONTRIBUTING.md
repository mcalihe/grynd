# Contributing to Grynd

Thanks for helping to make Grynd better. Grynd is a personal project, so please open an issue
before you start on a pull request. That way we can agree on the approach before you put time into
it.

## How to contribute

1. Read [`docs/plan.md`](docs/plan.md) for the product decisions behind a feature and
   [`CLAUDE.md`](CLAUDE.md) for the working agreement (code rules, commits, workflow).
2. Fork the repository and create a branch for your change. Keep commits small.
3. Use only Spartan helm components, design tokens and Transloco keys (no hardcoded colors or text).
4. Make sure `pnpm format:check`, `pnpm lint`, `pnpm test` and `pnpm e2e` pass.
5. Give the pull request a [Conventional Commits](https://www.conventionalcommits.org) title, for
   example `feat(workout): show the previous set while logging`. Pull requests are squash-merged and
   the title becomes the changelog entry.

## Contribution terms

Grynd is source-available under the [PolyForm Strict License 1.0.0](LICENSE), not open source.
The license lets you change the code only to prepare contributions to this repository.

By submitting a contribution (a pull request, patch, issue attachment or any other code, text,
image or material), you agree to the following:

1. **You have the right to contribute it.** The contribution is your own work, or you are otherwise
   entitled to submit it under these terms. It does not contain material under terms that conflict
   with them, such as code under the GPL.
2. **You grant a license to the maintainer.** You grant Michael Isler, and anyone Michael Isler
   authorizes, a perpetual, worldwide, non-exclusive, royalty-free, irrevocable license under your
   copyright and patent rights to use, copy, modify, publish, distribute, sublicense and sell your
   contribution, as part of Grynd or on its own, under any terms, including the terms in
   [LICENSE](LICENSE) and commercial terms.
3. **No compensation.** You will not receive payment or other compensation for your contribution.
4. **No other rights.** These terms give you no rights in Grynd beyond those in [LICENSE](LICENSE).
5. **No warranty.** You provide your contribution as is, without warranty of any kind.

If you do not agree to these terms, please do not submit a contribution.
