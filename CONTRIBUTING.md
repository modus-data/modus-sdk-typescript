# Contributing

Thank you for your interest in the Modus TypeScript SDK.

## Reporting Issues

Please open a [GitHub issue](https://github.com/modus-data/modus-sdk-typescript/issues)
for bug reports and feature requests. Include:

- SDK version (`npm list @modus/sdk` or `package.json`)
- Node.js version
- A minimal reproducible example

For security vulnerabilities, do not open a public GitHub issue — contact the
Modus team through your existing support channel.

## Questions & Support

For usage questions and general support, use the
[Modus community forum](https://modus.com) or email **support@modus.com**.

## Pull Requests

This repository is a **release mirror** of the TypeScript SDK package. Pull requests
are not accepted here.

Development happens in the Modus monorepo. If you have a proposed fix or feature,
open an issue in this repository and the team will route it internally.

## Running tests (from a source checkout)

If you have cloned this mirror with the `tests/` directory:

```bash
cd modus-sdk   # repository root after mirror split
npm install
npm test
```
