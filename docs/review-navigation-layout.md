# Review navigation and mobile clearance

## Internal navigation

- Settings / Review / Review link navigation defaults to Current page. New tab remains optional.
- ReviewNavigation captures internal Markdown links and Lexis relationship/occurrence links inside the review content. It prevents default URL dispatch and opens resolved files through WorkspaceLeaf.openFile(). Normal external hyperlinks are unchanged.
- Links use data-href, or the explicit data-lexis-review-link marker, before href. Heading/block/page subpaths remain intact. An internal link cannot dispatch an external URI scheme.
- Source buttons and reviewed/unreviewed row arrows share `openReviewCardSource`: preserve the current-page/new-tab preference, save navigation state, open the native note and position syntax cards at their source line (including line zero). Arrow activation does not toggle the answer. Missing Markdown links use Workspace.openLinkText() in the selected leaf, retaining Obsidian's creation behavior.
- The review ItemView declares navigation = true. Before opening a file and on view close it saves queue, position, revealed state, undo stack, options and reviewed count through the existing per-leaf session store. Native Back restores the view; its existing onOpen() takes that session and re-reveals the answer if needed. Closing also saves the state when navigating with native Back/Forward rather than a card link.
- No new global back button, OS protocol registration or persisted session format is introduced. Actual native mobile Back requires user verification.

## Mobile layout

- ReviewMobileLayout owns measurement, observers and cleanup, separate from grading and navigation.
- Phone/tablet/mobile layouts share the same rules. The rating bar remains above the configured bottom offset and the measured native toolbar, including viewport/safe-area changes.
- Clearance is the actual overlap between the scrolling viewport and the rating bar, plus 12px. A trailing, non-shrinking DOM spacer makes that area part of scroll height; it does not rely only on end padding. Hidden buttons reserve only the small end gap.
- ResizeObserver tracks bar/leaf/native-toolbar sizes. A style observer picks up configured offset changes; visualViewport and window resize/scroll events track visible area changes. Work is coalesced into one animation frame.
- Views dispose their observers on close. No note, schedule or learning-history data are changed by layout updates.

## Verification

- Unit tests cover current/new-tab routing, subpaths, internal missing-note creation, rejection of external schemes, capture interception and complete session snapshotting.
- Isolated Chrome fixtures render long mobile content and confirm the last paragraph stays above the buttons after taller buttons, offset changes and tablet mode. Hidden controls release the extra space.
- Build, types, lint and 500-line source limit remain required. Browser fixtures do not prove native iPhone toolbar/Back behavior; those checks stay user-operated.
