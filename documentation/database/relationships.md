# Relationships

## Overview

| Entity | Relationships |
| --- | --- |
| **User** | has many Submissions; has many Wishlist records |
| **Place** | has many Submissions; has many Experiences |
| **Submission** | belongs to one User; belongs to one Place; optionally belongs to one Experience |
| **Experience** | belongs to one Place; has many Tags through ExperienceTag; has many Wishlist records; can have many Submissions linked to it |
| **Tag** | belongs to many Experiences through ExperienceTag |
| **ExperienceTag** | connects one Experience to one Tag |
| **Wishlist** | connects one User to one Experience |

## Why join tables exist

**ExperienceTag** exists so an experience can have many tags and a tag can belong to many experiences, without duplicating tag rows or embedding tag lists on experiences.

**Wishlist** exists so a user can save many experiences and an experience can be saved by many users, while enforcing one wishlist entry per user–experience pair.

## Foreign key map

| From | To |
| --- | --- |
| `Submission.user_id` | `User.id` |
| `Submission.place_id` | `Place.id` |
| `Submission.experience_id` | `Experience.id` |
| `Experience.place_id` | `Place.id` |
| `ExperienceTag.experience_id` | `Experience.id` |
| `ExperienceTag.tag_id` | `Tag.id` |
| `Wishlist.user_id` | `User.id` |
| `Wishlist.experience_id` | `Experience.id` |

## Conceptual diagram

```text
User
 ├──< Submission
 └──< Wishlist >── Experience
                       │
Place ────────────────┘
 │
 └──< Experience
        │
        └──< ExperienceTag >── Tag

Submission ──> Experience
```
