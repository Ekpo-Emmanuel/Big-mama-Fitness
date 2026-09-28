import { test } from "vitest";
import assert from "node:assert/strict";
import {
  REGISTRATION_COMPLETE_MESSAGE,
  isRegistrationCompleteError,
} from "../lib/registration-intent";

test("registration-complete message is detected for paid intent reuse", () => {
  assert.equal(
    isRegistrationCompleteError(REGISTRATION_COMPLETE_MESSAGE),
    true,
  );
  assert.equal(isRegistrationCompleteError("sold out"), false);
});
