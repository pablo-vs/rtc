package avp

import (
	"errors"
	"fmt"
	"sync"
	"time"
	"os"
	"strconv"

	log "github.com/pion/ion-log"
	"github.com/pion/rtcp"

	"github.com/pion/webrtc/v3"
)

const (
	publisher  = 0
	subscriber = 1
)

var webmsaver_config []byte

// WebRTCTransportConfig represents configuration options
type WebRTCTransportConfig struct {
	configuration webrtc.Configuration
	setting       webrtc.SettingEngine
}

type SFUFeedback struct {
	StreamID string `json:"streamId"`
	Video    string `json:"video"`
	Audio    bool   `json:"audio"`
}

type PendingProcess struct {
	pid string
	fn  func() Element
}

// WebRTCTransport represents a webrtc transport
type WebRTCTransport struct {
	id  string
	pub *Publisher
	sub *Subscriber
	mu  sync.RWMutex

	builders  map[string]*Builder         // one builder per track
	pending   map[string][]PendingProcess // maps track id to pending element constructors
	processes map[string]Element          // existing processes
	onCloseFn func()
}

// NewWebRTCTransport creates a new webrtc transport
func NewWebRTCTransport(id string, c Config) *WebRTCTransport {
	conf := webrtc.Configuration{}
	se := webrtc.SettingEngine{}

	var icePortStart, icePortEnd uint16

	if len(c.WebRTC.ICEPortRange) == 2 {
		icePortStart = c.WebRTC.ICEPortRange[0]
		icePortEnd = c.WebRTC.ICEPortRange[1]
	}

	if icePortStart != 0 || icePortEnd != 0 {
		if err := se.SetEphemeralUDPPortRange(icePortStart, icePortEnd); err != nil {
			panic(err)
		}
	}

	var iceServers []webrtc.ICEServer
	for _, iceServer := range c.WebRTC.ICEServers {
		s := webrtc.ICEServer{
			URLs:       iceServer.URLs,
			Username:   iceServer.Username,
			Credential: iceServer.Credential,
		}
		iceServers = append(iceServers, s)
	}

	conf.ICEServers = iceServers

	config := WebRTCTransportConfig{
		setting:       se,
		configuration: conf,
	}

	pub, err := NewPublisher(config)
	if err != nil {
		log.Errorf("Error creating peer connection: %s", err)
		return nil
	}

	sub, err := NewSubscriber(config)
	if err != nil {
		log.Errorf("Error creating peer connection: %s", err)
		return nil
	}

	t := &WebRTCTransport{
		id:        id,
		pub:       pub,
		sub:       sub,
		builders:  make(map[string]*Builder),
		pending:   make(map[string][]PendingProcess),
		processes: make(map[string]Element),
	}

	sub.OnTrack(func(track *webrtc.TrackRemote, recv *webrtc.RTPReceiver) {
		id := track.ID()
		log.Debugf("Got track: %s", id)

		maxlate := c.SampleBuilder.AudioMaxLate
		if track.Kind() == webrtc.RTPCodecTypeVideo {
			maxlate = c.SampleBuilder.VideoMaxLate
		}

		if maxlate == 0 {
			log.Warnf("maxlate should not be 0. Using 100.")
			maxlate = 100
		}

		builder := NewBuilder(track, maxlate)
		t.mu.Lock()
		defer t.mu.Unlock()
		t.builders[id] = builder

		// If there is a pending pipeline for this track,
		// initialize the pipeline.
		if pending := t.pending[id]; len(pending) != 0 {
			for _, p := range pending {
				process := t.processes[p.pid]
				if process == nil {
					process = p.fn()
					t.processes[p.pid] = process
				}
				builder.AttachElement(process)
			}
			delete(t.pending, id)
		}

		if t.pending["all"] != nil && builder.Track().Kind() == webrtc.RTPCodecTypeVideo {
			e := registry.GetElement("webmsaver")
			proc := e(t.id, id, id, webmsaver_config)
			t.processes[id] = proc
			builder.AttachElement(proc)
			log.Infof("Adding %s to %s", id, t.id)
		}

		if track.Kind() == webrtc.RTPCodecTypeVideo {
			err := sub.pc.WriteRTCP([]rtcp.Packet{&rtcp.PictureLossIndication{SenderSSRC: uint32(track.SSRC()), MediaSSRC: uint32(track.SSRC())}})
			if err != nil {
				log.Errorf("error writing pli %s", err)
			}
		}

		builder.OnStop(func() {
			t.mu.Lock()
			b := t.builders[id]
			if b != nil {
				log.Debugf("stop builder %s", id)
				delete(t.builders, id)
			}
			t.mu.Unlock()

			if t.isEmpty() {
				// No more tracks, cleanup transport
				log.Infof("Empty transport. Closing...")
				t.Close()
			}
		})
	})

	go t.pliLoop(c.WebRTC.PLICycle)

	return t
}

func (t *WebRTCTransport) pliLoop(cycle uint) {
	if cycle == 0 {
		return
	}

	ticker := time.NewTicker(time.Duration(cycle) * time.Millisecond)
	for range ticker.C {
		t.mu.RLock()
		builders := t.builders
		t.mu.RUnlock()

		if len(builders) == 0 {
			return
		}

		var pkts []rtcp.Packet
		for _, b := range builders {
			pkts = append(pkts, &rtcp.PictureLossIndication{SenderSSRC: uint32(b.Track().SSRC()), MediaSSRC: uint32(b.Track().SSRC())})
		}

		err := t.sub.pc.WriteRTCP(pkts)
		if err != nil {
			log.Errorf("error writing pli %s", err)
		}
	}
}

func (t *WebRTCTransport) isEmpty() bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return len(t.builders) == 0 && len(t.pending) == 0
}

// OnClose sets a handler that is called when the webrtc transport is closed
func (t *WebRTCTransport) OnClose(f func()) {
	t.onCloseFn = f
}

// Close the webrtc transport
func (t *WebRTCTransport) Close() error {
	t.mu.Lock()
	log.Infof("Closing transport")
	defer t.mu.Unlock()

	if t.onCloseFn != nil {
		t.onCloseFn()
	}

	err := t.sub.Close()
	if err != nil {
		return err
	}
	return t.pub.Close()
}

// Process creates a pipeline
func (t *WebRTCTransport) Process(pid, tid, eid string, config []byte) error {
	log.Infof("WebRTCTransport.Process id=%s", pid)
	t.mu.Lock()

	if eid == "ts" {

		f, err := os.OpenFile("/out/sync_"+t.id, os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0666)

		if err != nil {
			log.Errorf("error opening file: %s", err)
			return nil
		}

		defer f.Close()

		f.WriteString(pid + "\n")
		for id, p := range t.processes {
			log.Infof("%v %v\n", id, strconv.Itoa(int(p.GetTs())))
			f.WriteString(id + " " + strconv.Itoa(int(p.GetTs())) + "\n")
		}
		f.WriteString("\n")
		defer t.mu.Unlock()
		return nil
	}

	e := registry.GetElement(eid)
	if e == nil {
		log.Errorf("element not found: %s", eid)
		return errors.New("element not found")
	}

	webmsaver_config = config

	log.Debugf("Builders: \n%s", t.builders)


	if pid == "all" {

		t.pending["all"] = []PendingProcess{PendingProcess{
			pid: "all",
			fn: func() Element {return nil},
		}}

		log.Infof("Pending: %v", t.pending)

		log.Infof("Set pending to all")
	} 

	for id, b := range t.builders {

		if b.Track().Kind() != webrtc.RTPCodecTypeVideo {
			log.Infof("Skipping audio builder %v", id)
			continue
		}

		log.Infof("Processing builder %v %v", id, b)

		if pid == "close" {
			log.Infof("Attempting to stop %s", id)
			defer func(bid string, b *Builder) {
				log.Infof("Attempting to stop %s", bid)
				/*for _,e := range b.elements {
					e.Close()
				}
				b.elements = []Element{}*/
				b.stop()
				t.processes[id] = nil
			}(id, b)
		} else if pid == "all" {

			defer func (id string, b *Builder) {
		/*	if b == nil {
				log.Debugf("builder not found for track %s. queuing.", id)
				t.pending[id] = append(t.pending[id], PendingProcess{
					pid: id,
					fn:  func() Element { return e(t.id, id, id, config) },
				})
				return nil
			}*/
				log.Debugf("Obtained builder %s", id)

				process := t.processes[id]
				 if process == nil {
					process = e(t.id, id, id, config)
					t.processes[id] = process
				}

				b.AttachElement(process)
			}(id, b)

		}

	}
	if pid == "close" {
		t.pending = make(map[string][]PendingProcess)
	}

	defer t.mu.Unlock()
	return nil
}

// CreateOffer starts the PeerConnection and generates the localDescription
func (t *WebRTCTransport) CreateOffer() (webrtc.SessionDescription, error) {
	return t.pub.CreateOffer()
}

// SetRemoteDescription sets the SessionDescription of the remote peer
func (t *WebRTCTransport) SetRemoteDescription(desc webrtc.SessionDescription) error {
	return t.pub.SetRemoteDescription(desc)
}

// Answer starts the PeerConnection and generates the localDescription
func (t *WebRTCTransport) Answer(offer webrtc.SessionDescription) (webrtc.SessionDescription, error) {
	return t.sub.Answer(offer)
}

// AddICECandidate accepts an ICE candidate string and adds it to the existing set of candidates
func (t *WebRTCTransport) AddICECandidate(candidate webrtc.ICECandidateInit, target int) error {
	switch target {
	case publisher:
		if err := t.pub.AddICECandidate(candidate); err != nil {
			return fmt.Errorf("error setting ice candidate: %w", err)
		}
	case subscriber:
		if err := t.sub.AddICECandidate(candidate); err != nil {
			return fmt.Errorf("error setting ice candidate: %w", err)
		}
	}
	return nil
}

// OnICECandidate sets an event handler which is invoked when a new ICE candidate is found.
// Take note that the handler is gonna be called with a nil pointer when gathering is finished.
func (t *WebRTCTransport) OnICECandidate(f func(c *webrtc.ICECandidate, target int)) {
	t.pub.OnICECandidate(func(c *webrtc.ICECandidate) {
		f(c, publisher)
	})
	t.sub.OnICECandidate(func(c *webrtc.ICECandidate) {
		f(c, subscriber)
	})
}
