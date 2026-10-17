# Code is not flashcard syntax

`flashcard-code-mask.ts` supplies a shared matching mask for `flashcard-syntax.ts`. Fenced code (backticks or tildes), quoted fences, indented code blocks and matched inline backtick spans cannot trigger question separators, bidirectional separators, block markers or cloze markers. Matching preserves character positions; card questions, answers and heading labels retain their original Markdown, never the mask.

The same exclusion applies to catalog discovery, review queue parsing, note-wide answer masking and individual cloze reveal. Code can still be part of a genuine question or answer when the marker is outside it: `` `std::deque`::A double-ended queue `` remains a card, while `` Example: `std::deque` `` does not.

Plain text is not broadly guessed to be a programming language. The common `std::Identifier` scope form is excluded from the default `::` question syntax; matched inline code remains the explicit exclusion for other code expressions. Unmatched backticks are literal Markdown, not an instruction to ignore the remainder of the note.

Inline-entry notes have one additional precedence rule. When their configurable entry delimiter is identical to the inline flashcard delimiter, the line remains a dictionary entry and does not also become a flashcard. Existing settings are preserved, while new installations use `=>` for inline entries so the two defaults no longer collide.

A bare heading/list marker is not a question: `### :: description` and `- :: description` are ignored. Real formatted questions such as `### Question::Answer` remain valid, as do literal symbols formatted as inline code before an outside separator.

No note or existing FSRS state/review history is deleted by this parser change. Normal catalog rebuilding removes obsolete discovery/priority entries through its existing policy. Ordinary cards retain the same content-based IDs; formerly mis-split cards can get corrected IDs because their actual question/answer changed. No invented history migration is performed. Whole-note review is unaffected: excluding code syntax does not exclude a vocabulary note itself.

`tests/flashcard-code-mask.test.mjs` covers code blocks, quoted and longer fences, indentation, single/multiple/multiline code spans, all four syntaxes, code-containing genuine cards, exact CRLF cloze offsets, heading labels, unchanged ordinary IDs and the plain-text ambiguity boundary. Existing syntax, catalog, review and isolated browser fixtures remain regression gates; native interaction is user-operated.
