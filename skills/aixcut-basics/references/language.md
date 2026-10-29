# Language Policy

This reference separates the language used to operate the agent from the language of the work produced in Aixcut.

## Three layers

1. **Tool and workflow layer:** MCP tool names, schema fields, enum values, error codes, Skill instructions, and validation rules stay in English. Stable product and API names are never translated.
2. **Conversation layer:** Follow the user's current conversation language for questions, confirmations, progress updates, errors, and completion summaries. If the user switches language, follow the latest clear language signal. Do not infer the reply language from the operating system, account region, or Skill file language.
3. **Content layer:** Use the requested language for titles, scripts, voiceover, captions, overlays, and generation prompts. Treat the audience or platform language as the default only when the user explicitly provides that target. A Chinese conversation may request an English video, and an English conversation may request Chinese captions.

## When to ask

Ask for the content language only when it materially changes the result and the user has not supplied a language, audience, source-language transformation, or existing copy. For a narrow request such as “add English subtitles” or “make the voiceover Spanish,” the target is already clear. For a broad request such as “make a promo video” with no language signal, use the conversation language for the first draft only if the user has clearly accepted that convention; otherwise ask one concise question.

Ask only about missing choices that would change the result. Do not run a fixed questionnaire or repeat information already given. Ask one concise question at a time; when a consequential choice is unresolved, do not spend generation credits or create several speculative versions to guess.

## Translation and preservation

- Preserve user-provided names, trademarks, quoted copy, URLs, API identifiers, and model names unless translation is explicitly requested.
- Do not translate a user's script silently. If the target language differs from the supplied script, confirm whether to translate, preserve the original, or create bilingual content when that choice affects the edit.
- A prompt written in English is not evidence that the generated asset must contain English words. Put the intended spoken or visible language in the content fields and prompt when the provider needs that hint.
- Keep product and interface labels in the locale shown by the user's current product surface. Keep Tool names, API identifiers, error codes, and refs unchanged; explain them in the conversation language when needed.

## Reporting

Report internal refs, statuses, error codes, and provider names exactly as returned, then explain their meaning in the user's language. Never expose credentials, signed URLs, private object keys, or hidden implementation details just to make a translation clearer.
