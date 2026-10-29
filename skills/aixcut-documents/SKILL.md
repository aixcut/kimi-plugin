---
name: aixcut-documents
description: "Import a user-provided local document into an Aixcut Project library. Do not use for media assets or reading only. Chinese triggers: 导入文档、添加 PDF、加入项目资料."
---

# Import Project Documents

## Conversation guidance

State what is being imported and what happens next when useful. Continue when the document and target Project are clear. If the user must select or provide a file, say exactly what to do and what will let the import continue. Report imported only after confirming the result.

## When to use

`aixcut_document(action="import")` is a local-MCP-only path. A hosted MCP server cannot read a path on the user's computer. Call it only when the MCP process itself has access to that path; otherwise call `aixcut_frontend(action="prompt_add_document")` and ask the user to choose the file in the Project Documents panel. Never send the computer path to the Tool.

- If the user only wants the document read, summarized, or used to answer a question, read it yourself and do not call this Tool.
- If no locally accessible path is provided, call `aixcut_frontend(action="prompt_add_document")`, wait for the user to choose the document, then call `aixcut_frontend(action="list_documents")` to confirm it appeared. Do not guess paths, scan directories, or fabricate content from a filename.
- Images, video, and audio are media assets. Use the published frontend media operations, not this Tool.

## Document content

| File type | `content` |
| --- | --- |
| Markdown, TXT, CSV, TSV | Optional. When omitted, the Tool reads the file directly. |
| PDF, Word, PowerPoint, Excel, HTML, RTF | Required. Read the file and provide its actual content as Markdown; the server does not parse these formats. |

- `content` must come from the file you actually read. Never infer it from the filename, invent it, or replace it with only a summary.
- Missing required content returns `MCP_DOCUMENT_CONTENT_REQUIRED`.
- If a text file is not valid UTF-8 (`MCP_DOCUMENT_ENCODING_INVALID`), read it and pass the text as `content`.
- Supported types are a fixed allowlist: Markdown, TXT, CSV, TSV, HTML, PDF, Word, PowerPoint, Excel, and RTF. Unsupported files such as ZIP or video return `MCP_DOCUMENT_MIME_UNSUPPORTED`; report that accurately and do not rename the extension to bypass validation.
- Preserve the source language and wording unless the user explicitly asks for a translation or rewrite. Apply the shared language policy from `aixcut-basics` when generating translated content.

## Call

The hosted MCP path does not support this call for a user-computer file. Use the browser-owned upload flow:

```json
{}
```

Read `aixcut_frontend(action="list_documents")` before opening the prompt to establish the existing document IDs. The action only opens the Project Documents upload entry. It does not upload or confirm a file. The user must choose the document; call `aixcut_frontend(action="list_documents")` and confirm the selected filename and document ID before reporting success. A stored document with `parse_status=parsing` still needs parsing; `error` means parsing failed. Poll only the document list while parsing and never reopen the upload prompt to check status. Do not pass `file_path`, `content`, or a local URL to this hosted action.

A local MCP process may use:

```json
{"file_path":"/path-visible-to-the-mcp-process/notes/product-overview.md"}
```

```json
{"file_path":"/Users/me/docs/quarterly-review.pdf","content":"# Quarterly Review\n\nActual document text in Markdown."}
```

- `file_path` must be an absolute local path. Relative paths return `MCP_DOCUMENT_PATH_INVALID`.
- `file_name` changes the name shown in the Documents panel; when omitted, the original filename is used.
- Add `mime_type` only when the extension is missing or incorrect.
- If `project_id` is omitted, the current Project is used.
- This Tool has no `idempotency_key`; do not add one. Duplicate detection is based on content.

## Persistence facts

- The original file is uploaded in full and remains available to open or download; the text is stored separately.
- Reimporting identical content returns `deduped`, even when the filename differs.
- Limits: 200 MiB per file and 32 MiB for extracted document text.
- The result is in `result.data.document`: `doc_id`, `relative_path`, `display_name`, `source`, `parse_status`, and `content_hash`. `result.status` is `imported` or `deduped`.
- The document appears in the Project document library, not on the timeline. It is visible in the Studio Documents panel.

## Recovery

| Error | Recovery |
| --- | --- |
| `MCP_DOCUMENT_PATH_INVALID`, `MCP_DOCUMENT_NOT_FOUND` | Confirm the path with the user, then retry. |
| `MCP_DOCUMENT_EMPTY`, `MCP_DOCUMENT_TOO_LARGE` | Report that the file is empty or over the limit and ask for another file. |
| `MCP_DOCUMENT_MIME_UNSUPPORTED` | Report that the type is unsupported; do not relabel it to force an upload. |
| `MCP_DOCUMENT_CONTENT_REQUIRED`, `MCP_DOCUMENT_ENCODING_INVALID`, `MCP_DOCUMENT_CONTENT_TOO_LARGE` | Supply actual `content` or reduce the extracted text, then retry. |
| `MCP_DOCUMENT_UPLOAD_FAILED` | Retry the same file once; if it fails again, report the failure. |

Path, file, and type errors in the first three rows will not be fixed by resending identical arguments.
