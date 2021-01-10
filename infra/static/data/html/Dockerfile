FROM python:3.8-buster

# Setup website gui on 7000

RUN mkdir /web
COPY ./ /web

EXPOSE 7000

WORKDIR /web/
CMD python3 -m http.server 7000 & sleep infinity
