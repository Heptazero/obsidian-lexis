import type { App, Command } from "obsidian";
import type { ReviewOptions } from "./types";

export function currentFileReviewCommand(host: {
  app: App;
  t(key: string): string;
  configureReview(options: ReviewOptions): void;
}): Command {
  return {
    id: "review-current-file",
    name: host.t("command.reviewCurrentFile"),
    checkCallback: (checking) => {
      const file = host.app.workspace.getActiveFile();
      if (file?.extension !== "md") return false;
      if (!checking) host.configureReview({ scope: "current", file: file.path, content: "syntax", mode: "cram", batchSize: null, rounds: 1 });
      return true;
    },
  };
}
