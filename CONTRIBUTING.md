# Contributing to Confide

Thank you for your interest in contributing to Confide! We love seeing new faces and code. Whether you're fixing a bug, adding a feature, or just improving docs, you are welcome here.

## Getting Started

### Prerequisites

*   **Docker** & **Docker Compose**
*   **Bun** (Latest) - [Install Bun](https://bun.sh/)
*   **Rust** (Latest stable) - Optional, only if editing backend code directly outside Docker.

### Setting up Development Environment

We provide a handy script to manage the entire development stack.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/confide-gg/confide.git
    cd confide
    ```

2.  **Start the Backend Stack (Central + Server + Databases):**
    ```bash
    ./infrastructure/scripts/setup-local.sh up
    ```
    This will start all necessary services in Docker containers.
    *   **Central API:** `http://localhost:3000`
    *   **Media Server:** `http://localhost:8080`

3.  **Run the Client:**
    Open a new terminal and run:
    ```bash
    ./infrastructure/scripts/setup-local.sh client
    ```
    This will install dependencies and start the Tauri development window.

### Useful Commands

*   `./infrastructure/scripts/setup-local.sh logs` - View backend logs.
*   `./infrastructure/scripts/setup-local.sh down` - Stop all backend services.
*   `./infrastructure/scripts/setup-local.sh rebuild` - Rebuild backend images after code changes.
*   `./infrastructure/scripts/setup-local.sh clean` - Wipe all data and start fresh.

## Submitting Changes

1.  **Fork** the repository on GitHub.
2.  Create a **new branch** for your feature or fix: `git checkout -b feat/amazing-feature`.
3.  Commit your changes with meaningful messages (we use Conventional Commits!).
    *   `feat: add new login screen`
    *   `fix: resolve crash on startup`
4.  **Push** to your fork and submit a **Pull Request**.

## Pull Request Guidelines

*   Keep PRs focused on a single task.
*   Update documentation if necessary.
*   Ensure the code builds and runs locally.
*   Be kind and patient during the review process.

## License

By contributing, you agree that your contributions will be licensed under the [GNU GPL v3 License](../LICENSE).