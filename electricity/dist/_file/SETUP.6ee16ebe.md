---
title: Setup / Environment
toc: true
---

# Setup for the Completed Project

This is the final setup guide for running the dashboard locally.

The shortest reliable path is:

1. pull the latest repository changes,
2. create or update the Conda environment,
3. install the frontend dependencies,
4. place the required `.env` file in `electricity/`,
5. install the SSH key used by the root `makefile`,
6. run `make app` from the project root.

## 1. Prerequisites

Before startup, make sure the following are available:

| Requirement | Purpose |
| :--- | :--- |
| **Git** | Clone or update the repository |
| **Conda / Miniconda** | Provides the `lmp-lite` Python environment |
| **Node.js 18+** and **npm** | Runs the Observable frontend and npm scripts |
| **OpenSSH** | Creates the SSH tunnel used by the app |
| **`lsof`** | Lets the `makefile` check and free local ports |

## 2. Clone or update the repository

If you do not have the project yet:

```bash
git clone https://github.com/nucapstone/project-spring26-darbyatNE.git
cd project-spring26-darbyatNE
```

If you already have a local copy, update it first:

```bash
git pull
```

## 3. Create the Conda environment

From the repository root:

```bash
conda env create -f electricity/environment.yml
conda activate lmp-lite
```

If the environment already exists and you want to refresh it to match the final dependency file:

```bash
conda env update -f electricity/environment.yml --prune
conda activate lmp-lite
```

## 4. Install frontend dependencies

The frontend and backend startup scripts are defined in `electricity/package.json`.

```bash
cd electricity
npm install
cd ..
```

## 5. Place the `.env` file in the correct location

For this project, the `.env` file should live in:

```text
electricity/.env
```

Use the credentials you were provided privately. At minimum, the backend expects:

```ini
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_HOST=127.0.0.1
DB_PORT=5433
DB_NAME=your_database_name
```

### Why `electricity/.env`?

The backend is started from the `electricity/` directory through `npm run dev`, so placing the file there is the most reliable way for `load_dotenv()` in `api/backend.py` to load it consistently.

## 6. Install the SSH key used by the root `makefile`

The application expects one of these keys:

- the default AWS key at `~/.ssh/AWS-Echo-Key.pem`, or
- a temporary evaluation key installed at `~/.ssh/prof_eval_key`.

If you were sent a temporary key, from the **project root** run:

```bash
make temp
```

Then paste the full private key and press `Ctrl-D`.

You can also use the one-block version:

```bash
make temp <<'EOF'
-----BEGIN OPENSSH PRIVATE KEY-----
[paste the full private key here]
-----END OPENSSH PRIVATE KEY-----
EOF
```

The `makefile` validates the saved key and applies the correct file permissions automatically.

## 7. Run the application

From the **repository root**:

```bash
make app
```

On success, the completed local stack starts:

- **Frontend:** `http://127.0.0.1:3000`
- **Backend:** `http://127.0.0.1:8000`

The root `makefile` also:

- checks for an SSH key,
- opens the SSH tunnel needed for database access,
- frees app ports if they are already in use,
- activates the `lmp-lite` Conda environment,
- launches the Observable frontend and FastAPI backend together.

## 8. Stop the tunnel / app session

To stop the SSH tunnel:

```bash
make stop
```

If the app is running in the foreground, you can also stop it with `Ctrl-C`.

## 9. Useful validation commands

If you only want to confirm the frontend docs and pages build correctly:

```bash
cd electricity
npm run build
```

If you want to inspect the available npm scripts:

```bash
cd electricity
npm run
```

## 10. Troubleshooting

### `make app` says no SSH key was found

Install the evaluation key with:

```bash
make temp
```

or place the permanent key at:

```text
~/.ssh/AWS-Echo-Key.pem
```

### The backend cannot connect to the database

Check that:

- `electricity/.env` exists,
- `DB_HOST=127.0.0.1`,
- `DB_PORT=5433`,
- the SSH tunnel started successfully,
- the credentials in `.env` match the provided database.

### `conda activate lmp-lite` fails

Make sure Conda or Miniconda is installed and initialized for your shell.

### The frontend fails to load

Reinstall dependencies:

```bash
cd electricity
npm install
cd ..
```

Then retry:

```bash
make app
```

### Ports are already in use

The `makefile` tries to free ports automatically, but you can still inspect them manually:

```bash
lsof -i :3000 -i :8000 -i :5433 -i :8001
```

## 11. Scope of this setup

This setup guide is for **running the completed dashboard**, not rebuilding the entire data pipeline from scratch.

The UI depends on a PostgreSQL database that already contains the expected service territory and pricing tables. The scripts in `src/hydrate/` are part of the broader data-maintenance workflow, but they are not required for the normal viewer/demo startup path.

For product usage, see [User Guide](./USER_GUIDE). For technical design, see [System Architecture](./ARCHITECTURE).
