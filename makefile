# Use bash
SHELL := /bin/bash

# 1. ssh tunnel command and path
TUNNEL_CMD = ssh -f -N -L 5433:127.0.0.1:5432 -L 8001:127.0.0.1:8000 -i ~/.ssh/AWS-Echo-Key.pem ubuntu@3.216.43.184 

# Command to find and cleanly kill this specific tunnel if it is already running
KILL_TUNNEL = pkill -f "[s]sh -f -N -L 5433" 2>/dev/null || true

ROOT_DIR = $(shell pwd)

# 2. Detect the OS so all can use 1 command
ifeq ($(OS),Windows_NT)
    DETECTED_OS := Windows
else
    DETECTED_OS := $(shell uname -s)
    IS_WSL := $(shell uname -r | grep -i microsoft)
endif

.PHONY: app stop

# The single target that handles all tasks for all OSes
app:
ifeq ($(DETECTED_OS),Darwin)
	@echo "Checking for existing tunnels..."
	@$(KILL_TUNNEL)
	@echo "Detected macOS. Spawning Apple Terminal..."
	@osascript -e 'tell app "Terminal" to do script "cd $(ROOT_DIR) && $(TUNNEL_CMD) && source \$$(conda info --base)/etc/profile.d/conda.sh && conda activate lmp-env && cd electricity && npm run dev"'

else ifeq ($(DETECTED_OS),Linux)
ifneq ($(IS_WSL),)
	@echo "Checking for existing tunnels..."
	@$(KILL_TUNNEL)
	@echo "Detected WSL. Starting tunnel silently, then running app in this terminal..."
	@$(TUNNEL_CMD)
	@source $$(conda info --base)/etc/profile.d/conda.sh && conda activate lmp-env && cd electricity && npm run dev
else
	@echo "Checking for existing tunnels..."
	@$(KILL_TUNNEL)
	@echo "Detected Native Linux. Spawning universal terminal..."
	@x-terminal-emulator -e bash -c "cd $(ROOT_DIR) && $(TUNNEL_CMD) && source \$$(conda info --base)/etc/profile.d/conda.sh && conda activate lmp-env && cd electricity && npm run dev; exec bash" || xterm -e bash -c "cd $(ROOT_DIR) && $(TUNNEL_CMD) && source \$$(conda info --base)/etc/profile.d/conda.sh && conda activate lmp-env && cd electricity && npm run dev; exec bash"
endif

else ifeq ($(DETECTED_OS),Windows)
	@echo "Checking for existing tunnels..."
	@-taskkill /F /IM ssh.exe >nul 2>&1 || true
	@echo "Detected Windows. Spawning Command Prompt..."
	@start cmd /k "cd /d $(ROOT_DIR) && start /b $(TUNNEL_CMD) && call conda activate lmp-env && cd electricity && npm run dev"

else
	@echo "Unsupported Operating System: $(DETECTED_OS)"
endif

# Kills the invisible SSH tunnel
stop:
	@echo "Stopping invisible SSH tunnels..."
	@$(KILL_TUNNEL)
	@echo "✅ Tunnels closed."
