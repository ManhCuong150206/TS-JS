# TLS certificates

`docker compose up --build` creates a self-signed certificate for `localhost` when no certificate exists. Browsers show a trust warning for this development certificate. Do not use it for a public deployment.

For a public host, replace `deploy/certs/tls.crt` and `deploy/certs/tls.key` with a certificate and private key issued for the deployment domain. Keep the private key out of Git. The Compose file mounts this directory read-only into Nginx.
