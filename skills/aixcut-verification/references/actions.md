# Review Action Reference

`aixcut_review(view="timeline")` is read-only. Its required `view` is exactly one of `project`, `timeline`, or `renderability`. `project_id` is optional when a Project is already active; `timeline_id` and `expected_revision` can be supplied when the caller needs a particular current timeline, following the live Tool Schema.

The result includes `view`, `ok`, `renderable`, `summary`, and `issues`, plus the Project/timeline identity and revision. `summary` reports error and warning counts and track/clip counts. Each issue reports severity, code, message, and an optional ref.

`renderability` checks a structural snapshot; it does not simulate an export or prove that media will decode, the requested content is present, playback is complete, audio is synchronized, or export will succeed. An empty timeline can pass these structural checks. Treat `ok=true` as “no structural errors found,” not “the requested video is complete.” The actual browser export result is reported separately by `export_timeline_status`.
