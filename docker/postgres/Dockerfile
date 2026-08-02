FROM postgres:17.10-bookworm AS pg-uuidv7-build

ARG PG_UUIDV7_COMMIT=d186b2516a49392f9d32db246e2339a2ed6d356a

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        git \
        postgresql-server-dev-17 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build/pg_uuidv7

RUN git init \
    && git remote add origin https://github.com/fboulnois/pg_uuidv7.git \
    && git fetch --depth 1 origin "${PG_UUIDV7_COMMIT}" \
    && git checkout --detach FETCH_HEAD \
    && make \
    && make install

FROM postgres:17.10-bookworm

COPY --from=pg-uuidv7-build /usr/lib/postgresql/17/lib/pg_uuidv7.so /usr/lib/postgresql/17/lib/pg_uuidv7.so
COPY --from=pg-uuidv7-build /usr/share/postgresql/17/extension/pg_uuidv7.control /usr/share/postgresql/17/extension/pg_uuidv7.control
COPY --from=pg-uuidv7-build /usr/share/postgresql/17/extension/pg_uuidv7--1.6.sql /usr/share/postgresql/17/extension/pg_uuidv7--1.6.sql
