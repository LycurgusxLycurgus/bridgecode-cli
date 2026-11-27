---
card: oneshot
state: ONESHOT
role: root
loads: status, in ONESHOT
---
FULL only: one self-contained attempt at the whole product. Always one file holding every CORE and NON-CORE criterion; the layout is ignored on purpose (the next-shot moves it).
1. PREVENT: `{{cmd}} stepback small --targets <every required ID> "<…>"`: quote the criteria, the relevant vetoes and the DEFINE decisions; name the real inputs; decide whether the target representation is one you handle well. The one-shot is its own one-block. If the output's shape is unclear, it is not a one-shot: `{{cmd}} advance EXPLORE --why oneshot`, or a re-define (`{{cmd}} advance ASK --why "<…>"`).
2. Generate the one file (yourself, or a builder: `{{cmd}} call builder-dynamic`). Familiar target: write it in the target stack. When the stack forces several files or an unfamiliar representation, Rosetta: write it in the representation you handle best; the next-shot translates it against authoritative references and target runs.
3. Run it on the real inputs: `{{cmd}} run -- <command>`; commit.
4. `{{cmd}} call reviewer`, append the run's evidence, then `{{cmd}} judge oneshot <ids>`; settle every NOT_MET with `{{cmd}} reproduce`. The review also triages: noise → a drop proposal; a good but unrequested extra → a backlog proposal.
5. The engine gives the outcome. PASS: every CORE criterion works (NON-CORE may still fail); the next-shot repairs the rest. Otherwise judge it: good when every failing CORE criterion has a local or relational cause (a sound base) → `{{cmd}} advance LOOP`, the next-shot; bad → never into loops: `{{cmd}} advance ASK --why "<the defect in the definition>"` when the definition is unclear or defective, `{{cmd}} advance EXPLORE --why oneshot` when it is clear but the shape or mechanism is wrong.
