FROM golang:1.24.8-bookworm@sha256:4ed690d6649d63c312b99a6120025ec79ce3b542968a37da53d6236c7c61a848 AS build

ENV CGO_ENABLED=0

RUN go install -trimpath -ldflags="-s -w" \
    github.com/minio/minio@9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a

RUN mkdir -p /out/data /out/tmp \
    && chown -R 10001:10001 /out/data /out/tmp \
    && chmod 1777 /out/tmp \
    && printf 'minio:x:10001:10001:MinIO:/tmp:/sbin/nologin\n' > /out/passwd \
    && printf 'minio:x:10001:\n' > /out/group

FROM scratch

COPY --from=build /go/bin/minio /usr/local/bin/minio
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build --chown=10001:10001 /out/data /data
COPY --from=build --chown=10001:10001 /out/tmp /tmp
COPY --from=build /out/passwd /etc/passwd
COPY --from=build /out/group /etc/group

ENV HOME=/tmp
ENV TMPDIR=/tmp

USER 10001:10001
VOLUME ["/data"]
EXPOSE 9000 9001

ENTRYPOINT ["/usr/local/bin/minio"]
CMD ["server", "/data", "--console-address", ":9001"]
