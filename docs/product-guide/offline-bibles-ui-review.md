## UI Checklist Review

Artifact: code review of the scripture picker, Settings, missing-translation rows, library credits and shared output credits, October 25, 2026. Rendered geometry and physical projector behavior were not inspected.

### Top 3 Priorities
1. Remove the online label from downloaded NKJV/NLT. Both use local picker rows; NLT retains its 1996 edition name.
2. Explain a missing download accurately. Missing NKJV/NLT rows are disabled with “not in this Bible database”; the app does not offer a YouVersion key as the remedy.
3. Preserve publisher credits after changing the source. Fixed the library footer and window credit subscription to include downloaded translations. Automated checks cover local credits and output formatting.

### Findings by Category

**Getting Started** - PASS
- Existing translation selectors remain the entry point.

**Typography** - N/A
- No typography rules changed. Edition-label fitting remains a visual check.

**Layout** - N/A
- Existing picker and footer layouts are reused; no rendered-layout claim is made.

**Color** - PASS
- Existing disabled and status treatments are retained.

**Style** - PASS
- No new controls or visual styles were introduced.

**Imagery** - N/A
- No imagery changed.

**Elements** - PASS
- Local, online and missing states have distinct labels. The source change no longer hides local publisher credits.

**Tactics** - PASS
- Settings and the shared guide lesson now describe full local translations without cache expiry.

### Summary
- No blocking issue remains in the reviewed code paths.
- The highest-priority finding was local attribution disappearing after the source changed; it is fixed.
- Rendered text fitting and physical-output checks remain unverified.
