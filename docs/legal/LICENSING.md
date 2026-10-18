# Trilorah source licensing

Current original Trilorah source uses **PolyForm Perimeter License 1.0.1**. This follows the founder's request to return to the restrictive option after the Apache choice. The current licence restricts providing competing products to others, including free competing offerings.

- [LICENSE](../../LICENSE) contains the unmodified [official PolyForm text](https://github.com/polyformproject/polyform-licenses/blob/1.0.0/PolyForm-Perimeter-1.0.1.md).
- [NOTICE](../../NOTICE) supplies the required copyright notice for Ayotomiwa Durojaye and identifies third-party boundaries.

## Rights and limits

Churches can use and customise Trilorah internally for their services under the permitted-purpose grant. Providing others a competing application or hosted service using the covered code is restricted; a separate permission would be needed for a use the licence does not grant. The restriction covers competing free products as well as paid ones.

This is a **source-available** licence. Do not describe it as standard open source, a blanket ban on all financial benefit, or a monopoly on independently written competing software. The licence text controls particular distribution and use cases; it does not grant unrestricted permission to publish a competing fork.

Distributors must provide the licence text or its URL and preserve supplied plain-text lines beginning with `Required Notice:`. NOTICE contains:

```text
Required Notice: Copyright 2026 Ayotomiwa Durojaye
```

Read the actual terms for their other conditions. The licence has not been rewritten with an invented additional commercial clause.

## Earlier licences and third-party material

This change does not revoke valid licences already granted for earlier copies. Copies validly received under Apache-2.0 or MIT remain subject to their applicable earlier terms. A local licence-file change does not establish that a previous public distribution occurred; this work did not publish a release or repository.

The current licence covers original Trilorah source except where separate terms are identified. It does not replace licences belonging to third-party software, fonts, models, Bible content, photographs or other imported material. Preserve [THIRD-PARTY-NOTICES.md](../../THIRD-PARTY-NOTICES.md) and accompanying notices. Online providers and licensed content also retain their separate arrangements.

## Source and package record

The root, website and Companion-module LICENSE files match the unmodified official PolyForm Perimeter 1.0.1 source:

- File size: 4,529 bytes.
- SHA-256: `5c7a5ccd847fcc285dda039e511ba013693fe979dfc5faee47f6fb59c7add337`.

Because this licence has no identifier in the reviewed SPDX list, package manifests use `SEE LICENSE IN LICENSE`, following [npm's documented convention](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#license). Each package root contains its own LICENSE. Root and web lockfile root metadata match their manifests; dependencies' licence records are not replaced.

The desktop [packaging configuration](../../electron-builder.yml) includes LICENSE, NOTICE and THIRD-PARTY-NOTICES.md. Verify the actual packaged archive and third-party contents when preparing a release. This documentation and metadata change did not build, publish or certify a distribution.

## Optional paid services

The founder has deferred defining the optional Trilorah-operated paid service. The code licence does not establish a hosted service, included provider usage, a support commitment or a price. Describe those separately once they are defined.
