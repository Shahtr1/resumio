# Resumio

Resumio is structured as a single repository with separate frontend and backend applications.

## Layout

```text
resumio/
  backend/   Spring Boot API
  frontend/  Angular app
```

## Backend

The backend is a standalone Spring Boot Maven project in `backend/`.

- Main build file: `backend/pom.xml`
- Run it from the `backend` directory

## Frontend

The frontend will live in `frontend/` as a standalone Angular project.

Recommended creation command from the repository root:

```bash
ng new frontend
```

## IDE

Use one of these approaches:

- Open `backend/` alone when working only on the API.
- Open the repository root when you want both frontend and backend in one workspace.

Do not add a Maven `pom.xml` at the repository root unless you intentionally want a Java multi-module build.
