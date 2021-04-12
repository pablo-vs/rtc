package server

import (
	"context"
	"sync"
	"os"

	avp "github.com/pion/ion-avp/pkg"
	log "github.com/pion/ion-log"
)

// AVP represents an avp instance
type AVP struct {
	config  avp.Config
	clients map[string]*SFU
	mu      sync.RWMutex
}

// NewAVP creates a new avp instance
func NewAVP(c avp.Config, elems map[string]avp.ElementFun) *AVP {
	a := &AVP{
		config:  c,
		clients: make(map[string]*SFU),
	}

	avp.Init(elems)

	return a
}

// Process starts a process for a track.
func (a *AVP) Process(ctx context.Context, addr, pid, sid, tid, eid string, config []byte) error {
	log.Infof("Processing request")

	if eid == "ts" {
		a.mu.Lock()
		defer a.mu.Unlock()

		log.Infof("Clients: %v", a.clients)
		c := a.clients[addr]
		// no client yet, create one
		if c == nil {
			return nil
		}

		t, err := c.GetTransport(sid)
		log.Infof("Got transport")
		if err != nil {
			return err
		}

		return t.Process(pid, tid, eid, config)
	} else if eid == "iden"{
		a.mu.Lock()
		defer a.mu.Unlock()

		f, err := os.OpenFile("/out/iden_"+sid, os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0666)

		if err != nil {
			log.Errorf("error opening file: %s", err)
			return nil
		}

		defer f.Close()

		f.WriteString(pid + tid + "\n")
		return nil

	} else {
		a.mu.Lock()
		defer a.mu.Unlock()

		log.Infof("Clients: %v", a.clients)
		c := a.clients[addr]
		// no client yet, create one
		if c == nil {
			log.Infof("Creating new client")
			var err error
			if c, err = NewSFU(addr, a.config); err != nil {
				return err
			}
			c.OnClose(func() {
				log.Infof("closing SFU client")
				/*a.mu.Lock()
				defer func(a *AVP) {
					a.mu.Unlock()
					log.Infof("Unlocked avp")
				}(a)*/
				delete(a.clients, addr)
			})
			a.clients[addr] = c
		}

		t, err := c.GetTransport(sid)
		log.Infof("Got transport")
		if err != nil {
			return err
		}

		return t.Process(pid, tid, eid, config)
	}
}
