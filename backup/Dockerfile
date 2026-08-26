FROM postgres:18-alpine

RUN apk add --no-cache aws-cli ca-certificates

COPY backup/backup.sh /backup.sh
RUN chmod +x /backup.sh

CMD ["/backup.sh"]
