import test from "node:test";
import assert from "node:assert/strict";
import { pageChanged } from "./change_monitor.ts";

test("whitespace-only page edits do not notify subscribers", () => {
  assert.equal(pageChanged("New post\n", "  New   post  "), false);
});

test("new page text is a meaningful change", () => {
  assert.equal(pageChanged("New post", "New post with a download"), true);
});
