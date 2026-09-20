# Tables

Finalized V1 model. Seven tables.

---

## User

**Purpose:** Stores account identity, display profile, and authorization role.

| Column | Type | Required | Default | Key / constraints | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | required | — | PK | |
| `name` | TEXT | required | — | | |
| `avatar` | TEXT | optional | — | | |
| `role` | TEXT | required | `user` | allowed: `user`, `curator`, `superadmin` | Constrained value |
| `email` | TEXT | required | — | UNIQUE | |
| `created_at` | TIMESTAMPTZ | required | `NOW()` | | |

---

## Place

**Purpose:** A geographic place where experiences and submissions are scoped.

| Column | Type | Required | Default | Key / constraints | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | required | — | PK | |
| `name` | TEXT | required | — | | |
| `slug` | TEXT | required | — | UNIQUE | |
| `city` | TEXT | required | — | | |
| `state` | TEXT | required | — | | |
| `latitude` | DOUBLE PRECISION | required | — | | |
| `longitude` | DOUBLE PRECISION | required | — | | |

---

## Submission

**Purpose:** Original contributor submission for curator review. Preserved even after approval, rejection, or linking to an experience.

| Column | Type | Required | Default | Key / constraints | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | required | — | PK | |
| `user_id` | UUID | required | — | FK → `User.id` | |
| `place_id` | UUID | required | — | FK → `Place.id` | |
| `experience_id` | UUID | optional | — | FK → `Experience.id` | Nullable until associated with an experience |
| `content` | TEXT | required | — | | Original contributor submission |
| `good_to_know` | TEXT | optional | — | | Original contributor information |
| `status` | TEXT | required | `pending` | allowed: `pending`, `approved`, `rejected` | Constrained value |
| `created_at` | TIMESTAMPTZ | required | `NOW()` | | |
| `updated_at` | TIMESTAMPTZ | required | `NOW()` | | Must be updated whenever the record is modified |

---

## Experience

**Purpose:** Curated public-facing thing to do at a place.

| Column | Type | Required | Default | Key / constraints | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | required | — | PK | |
| `place_id` | UUID | required | — | FK → `Place.id` | |
| `title` | TEXT | required | — | | |
| `description` | TEXT | optional | — | | |
| `good_to_know` | TEXT | optional | — | | Curated public-facing information |
| `created_at` | TIMESTAMPTZ | required | `NOW()` | | |
| `updated_at` | TIMESTAMPTZ | required | `NOW()` | | Must be updated whenever the record is modified |

---

## Tag

**Purpose:** Reusable label that can be applied to many experiences.

| Column | Type | Required | Default | Key / constraints | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | required | — | PK | |
| `name` | TEXT | required | — | UNIQUE | |

---

## ExperienceTag

**Purpose:** Join table connecting experiences and tags (many-to-many).

| Column | Type | Required | Default | Key / constraints | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | required | — | PK | |
| `experience_id` | UUID | required | — | FK → `Experience.id` | |
| `tag_id` | UUID | required | — | FK → `Tag.id` | |

**Composite unique:** `UNIQUE(experience_id, tag_id)`

---

## Wishlist

**Purpose:** Join table connecting users and saved experiences (many-to-many).

| Column | Type | Required | Default | Key / constraints | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | required | — | PK | |
| `user_id` | UUID | required | — | FK → `User.id` | |
| `experience_id` | UUID | required | — | FK → `Experience.id` | |
| `created_at` | TIMESTAMPTZ | required | `NOW()` | | |

**Composite unique:** `UNIQUE(user_id, experience_id)`
