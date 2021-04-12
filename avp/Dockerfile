FROM golang:1.15.6-buster

ENV GO111MODULE=on

RUN echo "deb http://www.deb-multimedia.org buster main" >> /etc/apt/sources.list
RUN wget https://www.deb-multimedia.org/pool/main/d/deb-multimedia-keyring/deb-multimedia-keyring_2016.8.1_all.deb
RUN dpkg -i deb-multimedia-keyring_2016.8.1_all.deb

RUN apt-get update && apt-get install -y \
    libvpx-dev

WORKDIR $GOPATH/src/github.com/pion/ion-avp

COPY go.mod go.sum ./
RUN cd $GOPATH/src/github.com/pion/ion-avp && go mod download

COPY pkg/ $GOPATH/src/github.com/pion/ion-avp/pkg
COPY cmd/ $GOPATH/src/github.com/pion/ion-avp/cmd
COPY examples/save-to-webm/ $GOPATH/src/github.com/pion/ion-avp/examples/save-to-webm

WORKDIR $GOPATH/src/github.com/pion/ion-avp
ENTRYPOINT ["/usr/local/go/bin/go"]
