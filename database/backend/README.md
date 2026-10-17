# Regression 3D database starter

TypeScript MongoDB models and the database connection module for the regression visualization project. This folder is a starter module; it does not yet contain the REST API or file-upload endpoint.

## Collections

- `lessons`: learning-card content such as title, category, level and visualization preset.
- `datasets`: dataset metadata, column information, a small preview and a reference to the original file.
- `experiments`: dataset reference, selected target/features, algorithm discriminator and configuration.
- `trainingRuns`: one record per training attempt, including metrics, model parameters and sampled history.

Uploaded dataset files are stored under `data/uploads` by the future API during local development. MongoDB stores only metadata and a storage key. Do not store a machine-specific absolute path or a public file URL in the document. When an API container is added, mount this directory into the API container (not the MongoDB container) and set `DATASET_STORAGE_DIR` to that container path.

## Local setup

1. Copy `.env.example` to `.env` and change the development password.
2. Start MongoDB with `docker compose up -d mongo`.
3. Install Node.js dependencies with `npm install`.
4. Build the TypeScript source with `npm run build`.
5. Check the connection with `npm run db:check` (or run the TypeScript entrypoint directly with `npm run db:check:dev`).

The MongoDB port is bound to localhost only. The named volume keeps database documents after the container is restarted. Dataset files belong to the API's storage volume and are kept separate from MongoDB's database files.

## Notes

- The schema is an initial proposal and should be reviewed with the API and frontend teams before adding endpoints.
- `algorithm.type` determines which configuration fields are accepted. Expand the validation when the team confirms its final algorithm list.
- `history` is sampled and bounded. Do not save every animation frame; generate the 3D view from the dataset and saved parameters.
- `ownerId` is optional until the project decides whether accounts/login are in scope.
- For a public deployment, use authentication/authorization, upload size limits, content validation, private file storage, backups and secrets management before accepting real user data.
