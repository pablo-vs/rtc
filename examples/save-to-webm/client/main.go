// Package pub-from-disk contains an example of publishing a stream to
// an ion-sfu instance from a file on disk.
package main

import (
	//"bufio"
	"context"
	//"os"
	//"strings"
	"time"
	"net/http"
	"io/ioutil"
	"encoding/json"
	"fmt"

	pb "github.com/pion/ion-avp/cmd/signal/grpc/proto"
	log "github.com/pion/ion-log"
	"google.golang.org/grpc"
)

const (
	address = "rtc-static.tk:49200"
	sfu     = "rtc-static.tk:5349"
)

type RecordingRequest struct {
	Type string
	Ssid string
}

func main() {
	fixByFile := []string{"asm_amd64.s", "proc.go"}
	fixByFunc := []string{}
	log.Init("info", fixByFile, fixByFunc)

	log.Infof("Start")

	fmt.Printf("Hello!")

	dur, _ := time.ParseDuration("5s")

	// Set up a connection to the avp server.
	conn, err := grpc.Dial(address, grpc.WithInsecure(), grpc.WithBlock(), grpc.WithTimeout(dur))
	if err != nil {
		log.Errorf("did not connect: %v", err)
		return
	}
	log.Infof("Connected to SFU")
	defer conn.Close()
	c := pb.NewAVPClient(conn)

	http.HandleFunc("/record", func(w http.ResponseWriter, r *http.Request) {

		body, err := ioutil.ReadAll(r.Body)
		if err != nil {
			panic(err)
		}
		var rr RecordingRequest
		err = json.Unmarshal(body, &rr)
		if err != nil {
			panic(err)
		}
		log.Infof(rr.Type)
		log.Infof(rr.Ssid)
		
		if rr.Type == "start" {

			sid := rr.Ssid
			ctx := context.Background()
			client, err := c.Signal(ctx)

			if err != nil {
				log.Errorf("Error intializing avp signal stream: %s", err)
				return
			}

			err = client.Send(&pb.SignalRequest{
				Payload: &pb.SignalRequest_Process{
					Process: &pb.Process{
						Sfu: sfu,
						Pid: "all",
						Sid: sid,
						Tid: "all",
						Eid: "webmsaver",
					},
				},
			})

			if err != nil {
				log.Errorf("error sending signal request: %s", err)
				return
			}
			log.Infof("Sent signal request")
		}

	})

	err = http.ListenAndServeTLS("0.0.0.0:8080", "/certs/cert.pem", "/certs/privkey.pem", nil)
	if err != nil {
		log.Infof(err.Error())
	}
}
