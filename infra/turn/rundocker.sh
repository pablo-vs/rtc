docker run --network host -d -v ~/turn/turnserver.conf:/etc/coturn/turnserver.conf -v ~/turn/certs:/certs instrumentisto/coturn $1 #turnserver --log-file=stdout
