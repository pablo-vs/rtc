Object.defineProperty(String.prototype, 'hashCode', {
  value: function() {
    var hash = 0, i, chr;
    for (i = 0; i < this.length; i++) {
      chr   = this.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }
});


function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


let UNIQUE_ID;// = uuidv4();//String(1.00000000001**(new Date().getTime())%1).hashCode()

if(true || document.cookie === "") {
    UNIQUE_ID = uuidv4();
    //document.cookie = "unique_id="+UNIQUE_ID;
} else {
    UNIQUE_ID = document.cookie.split(";")[0].split("=")[1];
}



// Config variables: change them to point to your own servers
const SIGNALING_SERVER_URL = 'https://rtc-static.tk:9999';
//const SIGNALING_SERVER_URL = 'http://localhost:9999';
//const TURN_SERVER_URL = 'localhost:3478';
const STUN_SERVER_URL = 'turn.rtc-static.tk:3478';
const TURN_SERVER_URL = 'turn.rtc-static.tk:3478';
const TURN_SERVER_USERNAME = 'rtcstatic';
const TURN_SERVER_CREDENTIAL = 'rtcstatic';
// WebRTC config: you don't have to change this for the example to work
// If you are testing on localhost, you can just use PC_CONFIG = {}
const PC_CONFIG = {
  iceServers: [
    {
      urls: 'turn:' + TURN_SERVER_URL + '?transport=tcp',
      username: TURN_SERVER_USERNAME,
      credential: TURN_SERVER_CREDENTIAL
    },
    {
      urls: 'stun:' + STUN_SERVER_URL + '?transport=tcp',
    },
    /*{
      urls: 'stun:' + STUN_SERVER_URL + '?transport=udp',
    },
    {
      urls: 'turn:' + TURN_SERVER_URL + '?transport=udp',
      username: TURN_SERVER_USERNAME,
      credential: TURN_SERVER_CREDENTIAL
    }*/
  ],
  iceTransportPolicy: 'relay'
};
console.log(PC_CONFIG);
//const PC_CONFIG = {};

// Signaling methods
let socket = io(SIGNALING_SERVER_URL, { autoConnect: false });

socket.on('data', (data) => {
  console.log('Data received: ',data);
  handleSignalingData(data);
});

socket.on('ready', (data) => {
  console.log('Ready');
  // Connection with signaling server is ready, and so is local stream
  createPeerConnection(data.id);
  sendOffer(data.id);
});

let sendData = (data, id) => {
  socket.emit('data', data={...data, 'to': id, 'from': UNIQUE_ID});
};

// WebRTC methods
let pcs = {};
let localStream;
let counter = 0;
let streams = document.getElementById("streams");

let remoteStreamElement = (id) => {
  let elem = document.getElementById("stream-"+id)
  if (elem === null) {
    let newstr = document.createElement("video");
    newstr.autoplay = true;
    newstr.id = "stream-"+id;
    newstr.playsinline = true;
    newstr.style = "background-color: black; object-fit: fill; width:30%; margin-right: 2%; height: 100%;";
    streams.appendChild(newstr);
    counter += 1;
    elem = newstr;
  }
  return elem
}

let getLocalStream = () => {
  navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    .then((stream) => {
      console.log('Stream found');
      localStream = stream;
      // Connect after making sure that local stream is availble
      socket.connect();
      socket.emit('setup', {'id': UNIQUE_ID});
    })
    .catch(error => {
      console.error('Stream not found: ', error);
    });
}

let createPeerConnection = (id) => {
  try {
    pcs[id] = new RTCPeerConnection(PC_CONFIG);
    console.log(pcs[id]);
    pcs[id].onicecandidate = (event) => { onIceCandidate(event, id); };
    pcs[id].onaddstream = (event) => { onAddStream(event, id); };
    pcs[id].oniceconnectionstatechange = (event) => { onIceConnectionStateChange(event, id); };
    pcs[id].addStream(localStream);
    console.log('PeerConnection created');
  } catch (error) {
    console.error('PeerConnection failed: ', error);
  }
};

let sendOffer = (id) => {
  console.log('Send offer');
  pcs[id].createOffer().then(
    (desc) => { setAndSendLocalDescription("offer", desc, id); },
    (error) => { console.error('Send offer failed: ', error); }
  );
};

let sendAnswer = (id) => {
  console.log('Send answer');
  pcs[id].createAnswer().then(
    (desc) => { setAndSendLocalDescription("answer", desc, id); },
    (error) => { console.error('Send answer failed: ', error); }
  );
};

let setAndSendLocalDescription = (type, sessionDescription, id) => {
  pcs[id].setLocalDescription(sessionDescription);
  console.log('Local description set');
  sendData({type: type, desc: sessionDescription}, id);
};

let onIceCandidate = (event, id) => {
  if (event.candidate) {
    //console.log('ICE candidate');
    sendData({
      type: 'candidate',
      candidate: event.candidate
    }, id);
  }
};

let onAddStream = (event, id) => {
  console.log('Add stream');
  remoteStreamElement(id).srcObject = event.stream;
};

let onIceConnectionStateChange = (event, id) => {
  console.log("Connection state change");
  if(pcs[id].iceConnectionState === "failed" ||
      pcs[id].iceConnectionState === "disconnected" ||
      pcs[id].iceConnectionState === "closed") {
    console.log("Disconnected");
    //streams.removeChild(remoteStreamElement(id));
    //remoteStreamElement(id).srcObject = null;
    //remoteStreamElement(id).style.width = 0;
  } else {
    /*let senders = pcs[id].getSenders();
    for(send in senders) {
	if(senders[send].track.kind === "video") {
	    remoteStreamElement(id).srcObject = senders[send].track;
	}
    }*/
    remoteStreamElement(id).style.width = "30%";
  }
}

let handleSignalingData = (data) => {
  switch (data.type) {
    case 'offer':
      id = data.from;
      if( !(id in pcs) ) {
        counter += 1;
        createPeerConnection(id);
      }
      pcs[id].setRemoteDescription(new RTCSessionDescription(data.desc));
      sendAnswer(id);
      break;
    case 'answer':
      id = data.from;
      /*if( !(id in pcs) ) {
        counter += 1;
        createPeerConnection(id);
      }*/
      pcs[data.from].setRemoteDescription(new RTCSessionDescription(data.desc));
      break;
    case 'candidate':
      id = data.from;
      /*if( !(id in pcs) ) {
        counter += 1;
        createPeerConnection(id);
      }*/
      pcs[data.from].addIceCandidate(new RTCIceCandidate(data.candidate));
      break;
  }
};

// Start connection
getLocalStream();
