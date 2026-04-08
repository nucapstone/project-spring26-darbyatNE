# Use bash
SHELL := /bin/bash

# 1. ssh tunnel command and path
AWS_KEY_PATH ?= $(HOME)/.ssh/AWS-Echo-Key.pem
TEMP_KEY_PATH ?= $(HOME)/.ssh/prof_eval_key
SSH_KEY_PATH ?= $(AWS_KEY_PATH)
TUNNEL_CMD = SELECTED_KEY_PATH="$(SSH_KEY_PATH)"; \
	if [ "$(SSH_KEY_PATH)" = "$(AWS_KEY_PATH)" ]; then \
		if [ -f "$(AWS_KEY_PATH)" ]; then \
			SELECTED_KEY_PATH="$(AWS_KEY_PATH)"; \
			echo "Using default AWS SSH key at $(AWS_KEY_PATH)"; \
		elif [ -f "$(TEMP_KEY_PATH)" ]; then \
			SELECTED_KEY_PATH="$(TEMP_KEY_PATH)"; \
			echo "AWS key not found. Using installed temporary SSH key at $(TEMP_KEY_PATH)"; \
		fi; \
	fi; \
	chmod 600 "$$SELECTED_KEY_PATH" 2>/dev/null || true; \
	ssh -o IdentitiesOnly=yes -f -N -L 5433:127.0.0.1:5432 -L 8001:127.0.0.1:8000 -i "$$SELECTED_KEY_PATH" ubuntu@3.216.43.184

# Verify that at least one usable SSH key is available before attempting the tunnel
CHECK_SSH_KEY = @if [ "$(SSH_KEY_PATH)" != "$(AWS_KEY_PATH)" ] && [ ! -f "$(SSH_KEY_PATH)" ]; then \
	echo "SSH key not found at $(SSH_KEY_PATH)."; \
	exit 1; \
fi; \
if [ "$(SSH_KEY_PATH)" = "$(AWS_KEY_PATH)" ] && [ ! -f "$(AWS_KEY_PATH)" ] && [ ! -f "$(TEMP_KEY_PATH)" ]; then \
	echo "No SSH key found at $(AWS_KEY_PATH) or $(TEMP_KEY_PATH). Run 'make temp' if you were sent a temporary evaluation key."; \
	exit 1; \
fi

# Command to find and cleanly kill this specific tunnel if it is already running
KILL_TUNNEL = pkill -f "[s]sh -f -N -L 5433" 2>/dev/null || true

# App and SSH tunnel ports that must be free before startup
APP_PORTS = 3000 8000 5433 8001

# Check each app port and stop any process currently listening on it
CHECK_AND_FREE_PORTS = @echo "Checking app ports: $(APP_PORTS)"; \
	for port in $(APP_PORTS); do \
		pids="$$(lsof -tiTCP:$$port -sTCP:LISTEN 2>/dev/null || true)"; \
		if [ -n "$$pids" ]; then \
			echo "Port $$port in use by PID(s): $$pids. Stopping..."; \
			kill $$pids 2>/dev/null || true; \
			sleep 1; \
			still="$$(lsof -tiTCP:$$port -sTCP:LISTEN 2>/dev/null || true)"; \
			if [ -n "$$still" ]; then \
				echo "Force killing remaining PID(s) on port $$port: $$still"; \
				kill -9 $$still 2>/dev/null || true; \
			fi; \
		else \
			echo "Port $$port is available."; \
		fi; \
	done

ROOT_DIR = $(shell pwd)
CONDA_ENV_NAME ?= lmp-lite

# 2. Detect the OS so all can use 1 command
ifeq ($(OS),Windows_NT)
    DETECTED_OS := Windows
else
    DETECTED_OS := $(shell uname -s)
    IS_WSL := $(shell uname -r | grep -i microsoft)
endif

.PHONY: app stop temp

# The single target that handles all tasks for all OSes
app:
ifeq ($(DETECTED_OS),Darwin)
	@echo "Checking for existing tunnels..."
	@$(KILL_TUNNEL)
	$(CHECK_AND_FREE_PORTS)
	$(CHECK_SSH_KEY)
	@echo "Detected macOS. Spawning Apple Terminal..."
	@osascript -e 'tell app "Terminal" to do script "cd $(ROOT_DIR) && $(TUNNEL_CMD) && source $$(conda info --base)/etc/profile.d/conda.sh && conda activate $(CONDA_ENV_NAME) && cd electricity && npm run dev; exec bash"'

else ifeq ($(DETECTED_OS),Linux)
ifneq ($(IS_WSL),)
	@echo "Checking for existing tunnels..."
	@$(KILL_TUNNEL)
	$(CHECK_AND_FREE_PORTS)
	@echo "Detected WSL. Starting tunnel silently, then running app in this terminal..."
	$(CHECK_SSH_KEY)
	@$(TUNNEL_CMD)
	@source $$(conda info --base)/etc/profile.d/conda.sh && conda activate $(CONDA_ENV_NAME) && cd electricity && npm run dev
else
	@echo "Checking for existing tunnels..."
	@$(KILL_TUNNEL)
	$(CHECK_AND_FREE_PORTS)
	@echo "Detected Native Linux. Spawning universal terminal..."
	$(CHECK_SSH_KEY)
	@x-terminal-emulator -e bash -c "cd $(ROOT_DIR) && $(TUNNEL_CMD) && source \$$(conda info --base)/etc/profile.d/conda.sh && conda activate $(CONDA_ENV_NAME) && cd electricity && npm run dev; exec bash" || xterm -e bash -c "cd $(ROOT_DIR) && $(TUNNEL_CMD) && source \$$(conda info --base)/etc/profile.d/conda.sh && conda activate $(CONDA_ENV_NAME) && cd electricity && npm run dev; exec bash"
endif

else ifeq ($(DETECTED_OS),Windows)
	@echo "Checking for existing tunnels..."
	@-taskkill /F /IM ssh.exe >nul 2>&1 || true
	@echo "Detected Windows. Spawning Command Prompt..."
	@start cmd /k "cd /d $(ROOT_DIR) && start /b $(TUNNEL_CMD) && call conda activate $(CONDA_ENV_NAME) && cd electricity && npm run dev"

else
	@echo "Unsupported Operating System: $(DETECTED_OS)"
endif

temp:
	@mkdir -p "$(HOME)/.ssh"
	@if [ -n "$(TEMP_KEY)" ]; then \
		printf '%b\n' "$(TEMP_KEY)" > "$(TEMP_KEY_PATH)"; \
	else \
		echo "Paste the full temporary SSH private key, then press Ctrl-D:"; \
		cat > "$(TEMP_KEY_PATH)"; \
	fi
	@chmod 600 "$(TEMP_KEY_PATH)"
	@if ssh-keygen -y -f "$(TEMP_KEY_PATH)" >/dev/null 2>&1; then \
		echo "✅ Temporary SSH key installed at $(TEMP_KEY_PATH)"; \
		echo "Next step: run 'make app'"; \
	else \
		echo "❌ The saved file is not a valid SSH private key. Please retry 'make temp' with the full key block."; \
		rm -f "$(TEMP_KEY_PATH)"; \
		exit 1; \
	fi

# Kills the invisible SSH tunnel
stop:
	@echo "Stopping invisible SSH tunnels..."
	@$(KILL_TUNNEL)
	@echo "✅ Tunnels closed."
