# Team 7 Git workflow

Use this workflow for the Campus Activities repository.

## Main rule

\`main\` is the shared, stable branch. Develop on a feature branch and use a Pull Request to merge finished work into \`main\`.

Always check your branch before working, committing, or pushing:

\`\`\`powershell
git status
git branch
\`\`\`

The branch with \`*\` is the branch you are using.

## Start a new task

\`\`\`powershell
git switch main
git pull --ff-only origin main
git switch -c feature-short-description
\`\`\`

Examples: \`feature-comments\`, \`feature-activity-crud\`, \`feature-ui-feed\`, \`feature-search\`.

\`--ff-only\` prevents Git from silently creating a merge commit on local \`main\`. If it fails, stop and ask for help.

## Work, test, and commit

\`\`\`powershell
git status
git diff
npm test
npm run lint
git add path/to/files
git status
git diff --cached
git commit -m "Describe the change"
\`\`\`

Stage only files belonging to the task when possible. Never commit \`.env\`, passwords, API keys, or other secrets.

## Push a feature branch

First push:

\`\`\`powershell
git push -u origin feature-short-description
\`\`\`

Later pushes:

\`\`\`powershell
git push
\`\`\`

Before pushing, verify the destination:

\`\`\`powershell
git status
git branch -vv
git remote -v
\`\`\`

Do not use \`git push origin feature-name:main\`. Do not use \`git push --force\` unless the team explicitly agrees.

## Pull Requests

Create a Pull Request on GitHub with:

\`\`\`text
base:    main
compare: feature-short-description
\`\`\`

Review the changed files and merge only after tests and lint pass. If more fixes are needed, stay on the same feature branch, commit, and push; the existing Pull Request updates automatically.

## After a Pull Request merges

\`\`\`powershell
git switch main
git pull --ff-only origin main
git branch -d feature-short-description
\`\`\`

The \`-d\` option refuses to delete a branch whose work is not merged.

## Keep a feature branch current

\`\`\`powershell
git switch main
git pull --ff-only origin main
git switch feature-short-description
git merge main
npm test
npm run lint
git push
\`\`\`

## Conflict recovery

Inspect the conflict:

\`\`\`powershell
git status
git diff --name-only --diff-filter=U
\`\`\`

Conflict markers look like this:

\`\`\`text
<<<<<<< HEAD
your current branch
=======
the branch being merged
>>>>>>> branch-name
\`\`\`

Choose the correct content, remove every marker, save the file, and verify it:

\`\`\`powershell
git diff --check
git add path/to/resolved-file
git status
git commit
\`\`\`

For a modify/delete conflict, one branch deleted the file and the other changed it:

\`\`\`powershell
# Keep the file:
git add path/to/file

# Confirm the deletion:
git rm path/to/file
\`\`\`

If you want to abandon a merge while it is in progress:

\`\`\`powershell
git merge --abort
\`\`\`

Do not run random reset or cleanup commands during a conflict.

## What happened with \`public/index.html\`

Your local \`main\` deleted the old placeholder page. Meanwhile, \`origin/main\` received the newer UI branch, which added and edited that same path. When \`git pull origin main\` combined the histories, Git could not decide whether the file should stay deleted or be kept, so it paused with a \`modify/delete\` conflict.

The project decision was to keep the newer UI file. After staging that choice, Git created the merge commit.

The characters that looked like \`Â·\` or \`ðŸ\` in one PowerShell output were a terminal display-encoding issue. [public/index.html](public/index.html) is valid UTF-8 and already declares \`<meta charset="utf-8">\`; the browser should display the symbols correctly.

## Quick reference

\`\`\`powershell
# Start work
git switch main
git pull --ff-only origin main
git switch -c feature-name

# Save work
git status
git add path/to/files
git diff --cached
git commit -m "Describe the change"

# Share work
git push -u origin feature-name

# After merge
git switch main
git pull --ff-only origin main
git branch -d feature-name
\`\`\`

