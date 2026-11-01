#!/bin/sh
# PreToolUse guard: stop shell and sandbox tools reaching helper/data, which
# holds the real provider login. Read/Edit deny rules don't cover these tools.
# It matches text in the command, so it is a safety net, not a full sandbox.
# The description field is removed first, so wording there can't block a command.
# robocopy's "/XD data" excludes the folder, so it is allowed.
input=$(cat | sed -E 's/"description":"([^"\\]|\\.)*"//g; s#/XD data##gI')
end='($|[^a-z0-9_.-])'
blocked=0
if printf '%s' "$input" | grep -qiE "helper[/\\\\]+data$end"; then
  blocked=1
elif printf '%s' "$input" | grep -qiE '(^|[^a-z0-9_-])helper([^a-z0-9_-]|$)' &&
     printf '%s' "$input" | grep -qiE "(^|[^a-z0-9_./\\\\-])data$end"; then
  blocked=1
fi
if [ "$blocked" = 1 ]; then
  echo "Blocked: helper/data holds real credentials and must not be touched." >&2
  exit 2
fi
exit 0
