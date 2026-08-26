FROM grafana/k6:latest

WORKDIR /loadtest
COPY loadtest/loadtest.js /loadtest/loadtest.js

ENTRYPOINT ["k6", "run", "/loadtest/loadtest.js"]
