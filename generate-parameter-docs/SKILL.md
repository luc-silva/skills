---
name: generate-parameter-docs
description: Reverse engineers legacy code to create standardized individual Markdown files for each configuration parameter in the docs/parametros/ directory. Use when documenting isolated parameters found in legacy codebases.
---

# Legacy System Parameter Documenter

## Objective

Standardize configuration parameter documentation in legacy systems by generating an independent `.md` file for each parameter in the `docs/parametros/` directory.

## Generated File Structure (`docs/parametros/PARAMETER_NAME.md`)

For each parameter identified in the codebase, create or update the file strictly following this structure:

```markdown
### Parameter Name (e.g., `FLG_AUTO_SEND_NOTFIS`)

* **Module / Flow:** [e.g., Billing, Invoice Issuance, Logistics]
* **Data Type:** [e.g., Boolean (Y/N), Integer, String, Enum (A/B/C)]
* **Default Value:** [e.g., 'N']
* **Where Consumed (Code):** File path and approximate line number
* **Database Impact:** Affected table or column

#### 📝 Detailed Description
Natural-language explanation of the business rule governed by the parameter.

#### ⚙️ Value Effects
* **Value 1:** What happens in the system.
* **Value 2:** What happens in the system.

#### 🔗 Dependencies and Interactions
* **Related Parameters:** Other parameters interacting with or dependent on this one.
* **Cautions / Side Effects:** Important warnings (e.g., requires cache invalidation/restart).

#### 🔄 Affected Flows
- [Flow Name 1](../fluxos/flow-1.md)

#### 🤖 Historical Context / Origin (Optional)
* Notes regarding creation, legacy background, or origin version.
```

## Execution Guidelines

1. Analyze static code searching for parameter readings (`if`, `switch`, configuration tables, etc.).
2. Write atomic documentation files focusing on the practical production impact of modifying values.
3. Ensure the `.md` file name matches the parameter name exactly (e.g., `FLG_AUTO_SEND_NOTFIS.md`).