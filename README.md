# rtc

- `app` contains the front-end code (HTML, CSS, native JS)
- `avp` contains the audiovisual processing module (aka recording service). It's a fork of pion/ion-avp (Golang)
- `sfu` contains configuration files for the selective forwarding unit, which is an unaltered copy of pion/ion-sfu (Golang)
- `html` contains configuration for the HTTPS server (nginx+letsencrypt) that serves the app
- `deploy` contains start-up scripts for the different (Bash)

Other components of the system not included in this repository are the TURN server (a standard software package), domain and SSL certificate information.
During normal operation, the system provides 5 different services in separate Docker containers:
  - HTML server: hosts the frontend code. Exposes port 443
  - TURN server: enables communication with peers behind NATs. Exposes port 3478
  - SFU: manages connections and sessions, forwards audiovisual streams to and from users.
         Exposes a range of ports for connection, as well as jsonrpc and grpc APIs
  - AVP server: provides services such as video recording. End clients don't directly interact with this. Exposes a grpc API
  - AVP client: acts as an interface between end clients and the AVP server. Exposes an HTTP API on port 9999
