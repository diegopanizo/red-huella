FROM pgvector/pgvector:0.8.5-pg17-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-17-postgis-3 \
        postgresql-17-postgis-3-scripts \
    && rm -rf /var/lib/apt/lists/*

COPY --chmod=0555 docker/postgres/init-app-role.sh /docker-entrypoint-initdb.d/10-app-role.sh

