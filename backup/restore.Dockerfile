FROM postgres:18-alpine

RUN apk add --no-cache aws-cli ca-certificates

COPY backup/restore-test.sh /restore-test.sh
RUN chmod +x /restore-test.sh

CMD ["/restore-test.sh"]
