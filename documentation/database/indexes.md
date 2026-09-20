# Indexes

## Why indexes exist

Indexes speed up lookups, joins, and filters on columns used in common queries. They also back unique constraints in PostgreSQL.

Add indexes based on actual query patterns. Do not index indiscriminately — unused indexes add write cost and storage without benefit.

## Unique constraints (and their indexes)

These unique constraints create useful unique indexes where PostgreSQL supports them:

- `User.email`
- `Place.slug`
- `Tag.name`
- `ExperienceTag(experience_id, tag_id)`
- `Wishlist(user_id, experience_id)`

`Place.slug` is therefore covered both as a uniqueness rule and as a lookup index.

## Recommended indexes

| Table | Column(s) | Notes |
| --- | --- | --- |
| Place | `slug` | Covered by unique constraint |
| Experience | `place_id` | Filter experiences by place |
| Submission | `user_id` | Submissions by user |
| Submission | `place_id` | Submissions by place |
| Submission | `experience_id` | Submissions linked to an experience |
| Submission | `status` | Curator queues by status |
| ExperienceTag | `experience_id` | Tags for an experience |
| ExperienceTag | `tag_id` | Experiences for a tag |
| Wishlist | `user_id` | Wishlist by user |
| Wishlist | `experience_id` | Wishlists containing an experience |
