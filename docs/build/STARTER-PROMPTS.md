# STARTER-PROMPTS.md — paste one of these to start each coding LLM session

## Shweta (first message, every new session)
```
You are Shweta (PLAY) on our 2-person team. Read AGENTS.md, then docs/build/RULES.md,
docs/build/CONTRACTS.md, docs/build/P1-TASKS.md, docs/build/PROGRESS-P1.md and docs/build/PROGRESS-P2.md.
Tell me in 3 lines what Dharm has done, what they're doing now, and anything they need from us.
Then propose the next unblocked Shweta task: its ID, the files you'll touch (only Shweta paths), and how we'll test it.
Don't write code until I say go. After each task, update docs/build/PROGRESS-P1.md and commit.
```

## Dharm (first message, every new session)
```
You are Dharm (BRAIN) on our 2-person team. Read AGENTS.md, then docs/build/RULES.md,
docs/build/CONTRACTS.md, docs/build/P2-TASKS.md, docs/build/PROGRESS-P2.md and docs/build/PROGRESS-P1.md.
Tell me in 3 lines what Shweta has done, what they're doing now, and any "Requests to Dharm" they've written.
Then propose the next unblocked Dharm task: its ID, the files you'll touch (only Dharm paths), and how we'll test it.
Don't write code until I say go. After each task, update docs/build/PROGRESS-P2.md and commit.
```

## Mid-session nudges (either person)
- **"Sync."** → pull `main`, re-read the partner's progress file, summarise changes in 3 lines.
- **"Done, next."** → run the task's *Done when* test, commit, update your progress file, propose the next task.
- **"We're behind."** → compare the clock with `docs/plan/13 §5`, propose cuts from `13 §7` in order.
- **"Merge time."** → stop, open `docs/build/MERGE-CHECKLISTS.md`, walk the right section with me.
- **"Blocked on partner."** → write a request in your own progress file, switch to the next unblocked task or the named mock/fixture.
