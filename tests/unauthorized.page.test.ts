import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("unauthorized page sign-out affordance", () => {
  it("offers a labeled Sign out action that uses Auth.js sign-out", () => {
    const pageSource = readFileSync(
      resolve("src/app/unauthorized/page.tsx"),
      "utf8",
    );
    const actionSource = readFileSync(
      resolve("src/lib/auth/actions.ts"),
      "utf8",
    );

    assert.match(pageSource, /signOutToLogin/);
    assert.match(pageSource, /Sign out/);
    assert.match(
      pageSource,
      /aria-label="Sign out and try a different account"/,
    );
    assert.match(pageSource, /Access restricted/);
    assert.match(
      pageSource,
      /does not have permission to use the admin area/,
    );

    assert.match(actionSource, /from "@\/auth"/);
    assert.match(actionSource, /signOut\(/);
    assert.match(actionSource, /redirectTo:\s*"\/login"/);
  });
});
