# dbt Manifest → Flora Diagram

When the user provides a dbt `manifest.json` (or asks you to read one from their project), generate a Flora lineage diagram from it.

## How to read the manifest

The key fields in `manifest.json`:

- **`nodes`** — models, snapshots, seeds, tests (keyed like `model.project_name.model_name`)
- **`sources`** — source tables (keyed like `source.project_name.source_name.table_name`)
- **`exposures`** — downstream consumers like dashboards (keyed like `exposure.project_name.name`)
- **`child_map`** — maps each node to its downstream dependents
- **`parent_map`** — maps each node to its upstream parents

Each node has `depends_on.nodes` listing its upstream dependencies by unique_id.

## Shape mapping

Map dbt resource types to Flora shapes:

| dbt resource | Flora shape | Why |
|-------------|-------------|-----|
| `source` | `[(name)]` cylinder | Sources are databases/tables |
| `seed` | `[(name)]` cylinder | Seeds are loaded data files |
| `model` | `[name]` rectangle | Models are transformations |
| `exposure` | `([name])` stadium | Exposures are terminal outputs |
| `snapshot` | `[(name)]` cylinder | Snapshots are stored state |

Skip `test` nodes — they clutter the lineage diagram.

## Subgraph grouping

Group models into subgraphs by their dbt layer, inferred from prefix or folder:

| Pattern | Subgraph label |
|---------|---------------|
| `stg_*` or `staging/` folder | Staging |
| `int_*` or `intermediate/` folder | Intermediate |
| `fct_*`, `dim_*`, or `marts/` folder | Marts |

If the manifest is small (<15 models), skip subgraphs — keep it flat. Sources and exposures stay outside subgraphs.

## Node labels

Use the model's short name, not the full unique_id. Strip the `stg_`, `fct_`, `dim_` prefix for cleaner labels only if the subgraph already communicates the layer. Otherwise keep the prefix.

## Example

Given a manifest with models `stg_orders`, `stg_payments`, `fct_orders`, `dim_customers`, and a source `raw.orders`:

```
flowchart TD
  raw_orders[(orders)]

  subgraph Staging
    stg_orders[stg_orders]
    stg_payments[stg_payments]
  end

  subgraph Marts
    fct_orders[fct_orders]
    dim_customers[dim_customers]
  end

  dashboard([Dashboard])

  raw_orders --> stg_orders
  raw_orders --> stg_payments
  stg_orders --> fct_orders
  stg_payments --> fct_orders
  stg_orders --> dim_customers
  fct_orders --> dashboard
```

## Large manifests

For manifests with many models (30+), ask the user which part of the lineage they want to see. Options:
- A specific model and its upstream/downstream (e.g., "show lineage for fct_orders")
- A specific layer (e.g., "just show me staging → marts")
- A specific source and everything downstream of it

Don't try to render 100+ nodes — it will be unreadable. Filter first, then diagram.
