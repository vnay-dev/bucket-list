# Constraints

Database constraints protect data integrity. Application code handles business workflows.

An approved submission does **not** automatically create an experience at the database layer. Creating or associating an experience is handled by the application/admin system.

---

## Primary keys

Every table has its own UUID primary key:

- `User.id`
- `Place.id`
- `Submission.id`
- `Experience.id`
- `Tag.id`
- `ExperienceTag.id`
- `Wishlist.id`

---

## Foreign keys

All relationships in [relationships.md](./relationships.md) are enforced with foreign keys.

---

## Role

`User.role` can only be:

- `user`
- `curator`

Default: `user`

---

## Submission status

`Submission.status` can only be:

- `pending`
- `approved`
- `rejected`

Default: `pending`

---

## Unique values

| Constraint | Scope |
| --- | --- |
| `User.email` | unique |
| `Place.slug` | unique |
| `Tag.name` | unique |
| `ExperienceTag(experience_id, tag_id)` | composite unique |
| `Wishlist(user_id, experience_id)` | composite unique |

---

## Required vs optional

### Required (NOT NULL)

| Table | Columns |
| --- | --- |
| User | `id`, `name`, `role`, `email`, `created_at` |
| Place | `id`, `name`, `slug`, `city`, `state`, `latitude`, `longitude` |
| Submission | `id`, `user_id`, `place_id`, `content`, `status`, `created_at`, `updated_at` |
| Experience | `id`, `place_id`, `title`, `created_at`, `updated_at` |
| Tag | `id`, `name` |
| ExperienceTag | `id`, `experience_id`, `tag_id` |
| Wishlist | `id`, `user_id`, `experience_id`, `created_at` |

### Optional (nullable)

| Table | Columns |
| --- | --- |
| User | `avatar` |
| Submission | `experience_id`, `good_to_know` |
| Experience | `description`, `good_to_know` |

---

## Delete behavior

| Relationship | Behavior |
| --- | --- |
| User → Submission | Do **not** cascade-delete submissions. Restrict (or otherwise handle safely) so user deletion cannot silently wipe submissions. |
| User → Wishlist | Wishlist records **can** be deleted with the user (`CASCADE`). |
| Place → Experience | **Restrict** deletion of a place while experiences reference it. |
| Place → Submission | **Restrict** deletion of a place while submissions reference it. |
| Experience → Submission | If an experience is deleted, **preserve** the submission and set `Submission.experience_id` to `NULL` (`SET NULL`). |
| Experience → ExperienceTag | Delete relationship records when the experience is deleted (`CASCADE`). |
| Tag → ExperienceTag | Delete relationship records when the tag is deleted (`CASCADE`). |
| Experience → Wishlist | Delete wishlist records when the experience is deleted (`CASCADE`). |
