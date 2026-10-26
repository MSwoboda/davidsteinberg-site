# Questionnaires

Each questionnaire is one JSON document, imported in the admin dashboard (Questionnaires → Import) or written to
Firestore `questionnaires/{id}`. `self-check.json` is the free six-item check from the course page and is a working
example; `TEMPLATE.json` shows every field.

Fields: `id`, `title`, `kind` (`self` | `couples` | `individual`), `instructions`, `scale` (default answer scale),
`items[]` (`id`, `text`, optional `type` = `likert` | `yesno` | `text`), `scoring` (`method`: `sum` | `mean` | `none`,
`reverse`: item ids scored backwards, `bands`: upper bounds with labels).

The fourteen Sound Relationship House instruments go in as fourteen files in the same shape. Each partner of a couple
answers separately; the dashboard shows both answer sets side by side.
