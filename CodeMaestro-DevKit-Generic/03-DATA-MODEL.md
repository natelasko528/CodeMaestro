# 03 — DATA MODEL (Template)

### Entity: {{ENTITY_NAME}}
| Field | Type | Required | Unique | Notes |
|------|------|----------|--------|------|
| id | uuid | yes | yes | primary key |
| {{field}} | {{type}} | {{yes/no}} | {{yes/no}} | {{notes}} |

## Relationships
- {{ENTITY_A}} 1—N {{ENTITY_B}}

## Migrations Strategy
- Tool: {{MIGRATION_TOOL}}
- Seed strategy: {{SEED_STRATEGY}}
