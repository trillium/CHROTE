#!/bin/bash
# Terminal Launcher for CHROTE (macOS)
# ttyd calls this with the session name as $1
export LANG=en_US.UTF-8
cd ~/gt 2>/dev/null || cd ~
SESSION="$1"
if [ -n "$SESSION" ] && tmux has-session -t "$SESSION" 2>/dev/null; then
    exec tmux attach-session -t "$SESSION"
else
    exec zsh -l
fi
