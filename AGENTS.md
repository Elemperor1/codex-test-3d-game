# Agent Instructions

- Place clear, bullet-pointed summaries and testing sections in final responses.
- Cite code changes using file and line references after each bullet in the summary.
- Prefix test commands in the testing section with ✅, ⚠️, or ❌ to indicate status.
- When modifying files under this repository, prefer concise diffs and keep direction semantics consistent with three.js conventions.
- All new features must use the centralized logger. Log entries should include a severity tag (e.g., DEBUG/INFO/WARN/ERROR), a concise user-facing summary, and relevant contextual metadata (module, scene, actor IDs, user/session identifiers, and feature toggles). Format messages so that severity and summary are easily searchable, and keep metadata structured for downstream parsing.
- When capturing crash or error details, record stack traces, error codes, and triggering inputs, but avoid logging secrets or user-generated sensitive content; mask tokens/credentials and redact PII before writing to logs.
- If adding new logging sinks (file, remote collector, telemetry pipeline) or contexts (scenes, subsystems, background workers), ensure they integrate with the centralized logger API, preserve existing formats, and include backward-compatible fallbacks. Document any new sink/context configuration in code comments nearest the initialization point.
