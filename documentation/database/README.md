# Database

## Purpose

The database stores the core V1 domain data for discovering things to do in a place: users, places, contributor submissions, curated experiences, tags, and wishlists.

## Technology

| Item | Choice |
| --- | --- |
| Database | PostgreSQL |
| Hosting | Neon |
| ORM | Drizzle |
| V1 tables | 7 |

## Tables

| Table | Purpose |
| --- | --- |
| [User](./tables.md#user) | Account identity, profile, and role |
| [Place](./tables.md#place) | A location where experiences exist |
| [Submission](./tables.md#submission) | Contributor input awaiting curator review |
| [Experience](./tables.md#experience) | Curated public thing-to-do at a place |
| [Tag](./tables.md#tag) | Reusable label for experiences |
| [ExperienceTag](./tables.md#experiencetag) | Many-to-many link between experiences and tags |
| [Wishlist](./tables.md#wishlist) | Many-to-many link between users and saved experiences |

## Documentation map

| File | Contents |
| --- | --- |
| [tables.md](./tables.md) | Columns, types, keys, and notes per table |
| [relationships.md](./relationships.md) | Entity relationships and FK map |
| [constraints.md](./constraints.md) | Integrity rules and delete behavior |
| [indexes.md](./indexes.md) | Indexing strategy |
| [workflows.md](./workflows.md) | Important V1 data workflows |
