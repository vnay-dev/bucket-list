# Workflows

Important V1 data workflows. Application/admin code owns these flows; the database enforces integrity rules only.

---

## 1. User submission

1. User signs in with Google (Auth.js); a `User` row is created on first login
2. User submits an experience via the authenticated API
3. A `Submission` is created with `user_id` from the session (never from the client body)
4. `status` = `pending`
5. A curator reviews it

See [Authentication](../authentication.md) for sign-in and role details.

---

## 2. Approve submission

1. Curator reviews the `Submission`
2. Curator approves it
3. Curator creates or associates an `Experience`
4. `Submission.experience_id` references that `Experience`
5. The `Experience` becomes public

Approval does not auto-create an experience in the database. The application/admin system performs that step.

---

## 3. Duplicate submission

1. User submits something that already exists
2. Curator identifies the existing `Experience`
3. `Submission.experience_id` points to that `Experience`
4. The original `Submission` remains preserved

---

## 4. Reject submission

1. Curator reviews the `Submission`
2. Curator rejects it
3. `status` = `rejected`
4. The `Submission` remains stored

---

## 5. Wishlist

1. User saves an `Experience`
2. A `Wishlist` record is created

If the user saves the same experience again, it is prevented by `UNIQUE(user_id, experience_id)`.

---

## 6. Tagging

```text
Experience → ExperienceTag → Tag
```

- An experience can have many tags
- A tag can belong to many experiences

---

## 7. Curated content

| Source | Meaning |
| --- | --- |
| `Submission` content | Contributor input |
| `Experience` content | Curated public content |

Do not assume the public experience must display the original submission text exactly.

---

## 8. QA → Production promotion

When curated content in QA is ready for launch, promote Places, Experiences, Tags, and ExperienceTags associated with **approved** submissions into Production via the CLI:

```bash
npm run promote:qa -- --dry-run
npm run promote:qa -- --confirm-production
```

Users, Wishlists, and Submissions are not promoted. See [Promotion](../promotion.md) for environment variables, idempotency, rollback (Neon), and limitations.
