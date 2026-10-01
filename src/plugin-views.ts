"use strict";

import { createReviewView } from "./review-view";
import { LEXIS_REVIEW_VIEW } from "./constants";
import { renderLexisMarkdown, todayString as todayStr } from "./shared-utils";

const LexisReviewView = createReviewView({ reviewViewType: LEXIS_REVIEW_VIEW, todayStr, renderLexisMarkdown });

export { LexisReviewView };
