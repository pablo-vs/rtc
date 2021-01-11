/*
 *
 *  NETWORKING
 *
 */



Object.defineProperty(String.prototype, 'hashCode', {
  value: function() {
    var hash = 0, i, chr;
    for (i = 0; i < this.length; i++) {
      chr   = this.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(16).substr(2,10);
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
  //iceTransportPolicy: 'relay'
};
console.log(PC_CONFIG);
//const PC_CONFIG = {};

// Signaling methods
let socket = io(SIGNALING_SERVER_URL, { autoConnect: false });

function connect(callback = null) {
  socket.connect();
  socket.emit('setup', {'id': UNIQUE_ID, 'room': roomId}, callback);
  displayStats();
}

socket.on('data', (data) => {
  console.log('Data received: ',data);
  handleSignalingData(data);
});

socket.on('ready', (data) => {
  console.log('Ready');
  // Connection with signaling server is ready, and so is local stream
  createPeerConnection(data.id);
});

socket.on('disconnected', (data) => {
  console.log('Remote disconnected');
  // Connection with signaling server is ready, and so is local stream
  removeStreamElement(data.id);
  pcs[id].close();
  displayStats();
});

let sendData = (data, id) => {
  socket.emit('data', data={...data, 'to': id, 'from': UNIQUE_ID});
};


/*
 *
 *  Streams
 *
 */


// WebRTC methods
let pcs = {};
let localStream = new MediaStream();
let playbackStream = new MediaStream();
let localVideoTrack;
let localAudioTrack;
let localVideoSenders = {};
let localAudioSenders = {};
let dataChannels = {};
let counter = 0;
let streams = document.getElementById("streams");

let remoteStreamElement = (id) => {
  let elem = document.getElementById("stream-"+id)
  if (elem === null) {
    let div = document.createElement("div");
    div.classList.add("video");
    let newstr = document.createElement("video");
    newstr.autoplay = true;
    newstr.id = "stream-"+id;
    newstr.playsinline = true;
    div.appendChild(newstr);
    streams.appendChild(div);
    counter += 1;
    elem = newstr;
  }
  return elem
}

let localStreamElement = remoteStreamElement('self');
localStreamElement.srcObject = playbackStream;


let removeStreamElement = (id) => {
  if(id in pcs) {
    streams.removeChild(remoteStreamElement(id).parentElement);
  }
}

let getLocalVideoTrack = async () => {
  return await navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
      console.log('Video stream found');
      localVideoTrack = stream.getVideoTracks()[0];
      localStream.addTrack(localVideoTrack);
      playbackStream.addTrack(localVideoTrack);
      return true;
    })
    .catch(error => {
      console.error('Stream not found: ', error);
      alert("No se ha detectado ninguna cámara o se ha denegado el permiso")
      return false;
    });
}

let getLocalAudioTrack = async () => {
  return await navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      console.log('Stream found');
      localAudioTrack = stream.getAudioTracks()[0];
      localStream.addTrack(localAudioTrack);
      return true;
    })
    .catch(error => {
      console.error('Stream not found: ', error);
      alert("No se ha detectado ningún micrófono o se ha denegado el permiso")
      return false;
    });
}

let addLocalVideoTrack = (id = null) => {
  localStreamElement.srcObject = playbackStream;
  if(localVideoTrack) {
    if(id) {
        localVideoSenders[id] = pcs[id].addTrack(localVideoTrack, localStream);
    } else {
      for(i in pcs) {
        localVideoSenders[i] = pcs[i].addTrack(localVideoTrack, localStream);
      }
    }
    console.log("Local video track added");
  }
}

let removeLocalVideoTrack = () => {
  localStream.removeTrack(localVideoTrack);
  localStreamElement.srcObject = null;
  for(i in pcs) {
    pcs[i].removeTrack(localVideoSenders[i]);
  }
}

let addLocalAudioTrack = (id = null) => {
  if(localAudioTrack) {
    if(id) {
        localAudioSenders[id] = pcs[id].addTrack(localAudioTrack, localStream);
    } else {
      for(i in pcs) {
        localAudioSenders[i] = pcs[i].addTrack(localAudioTrack, localStream);
      }
    }
    console.log("Local audio track added");
  }
}

let removeLocalAudioTrack = () => {
  localStream.removeTrack(localAudioTrack);
  //localStreamElement.srcObject = localStream;
  for(i in pcs) {
    pcs[i].removeTrack(localAudioSenders[i]);
  }
}

let createPeerConnection = (id) => {
  try {
    pcs[id] = new RTCPeerConnection(PC_CONFIG);
    console.log(pcs[id]);
    pcs[id].onicecandidate = (event) => { onIceCandidate(event, id); };
    pcs[id].ontrack = (event) => { onTrack(event, id); };
    //pcs[id].oniceconnectionstatechange = (event) => { onIceConnectionStateChange(event, id); };
    pcs[id].onnegotiationneeded = (event) => { onNegotiationNeeded(event, id); };
    dataChannels[id] = pcs[id].createDataChannel("chat");
    addLocalVideoTrack(id);
    addLocalAudioTrack(id);
    remoteStreamElement(id);
    displayStats();
    //localVideoSenders[id] = pcs[id].addTrack(localStream.getVideoTracks()[0], localStream);
    //localAudioSenders[id] = pcs[id].addTrack(localStream.getAudioTracks()[0], localStream);
    console.log('PeerConnection created');
  } catch (error) {
    console.error('PeerConnection failed: ', error);
  }
};

let onNegotiationNeeded = (event, id) => {
  sendOffer(id);
}

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
    console.log('ICE candidate');
    sendData({
      type: 'candidate',
      candidate: event.candidate
    }, id);
  }
};

let onTrack = (event, id) => {
  console.log('Add stream');
  console.log(event);
  streamElem = remoteStreamElement(id),
  streamElem.srcObject = event.streams[0];
  event.streams[0].onremovetrack = (event) => { onRemoveTrack(event, streamElem); };
};

let onRemoveTrack = (event, streamElem) => {
  streamElem.srcObject = null;
  streamElem.style.bacgroundColor = "black";
}

/*
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
    }
    //remoteStreamElement(id).style.width = "30%";
  }
}*/

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
      pcs[data.from].setRemoteDescription(new RTCSessionDescription(data.desc));
      break;
    case 'candidate':
      id = data.from;
      pcs[data.from].addIceCandidate(new RTCIceCandidate(data.candidate));
      break;
  }
};


/*
 *
 * BUTTONS
 *
 */

let cameraOn = false;
let cameraElement = document.getElementById("camera");
let micOn = false;
let micElement = document.getElementById("mic");

async function cameraClick(event) {
  if(cameraOn) {
    removeLocalVideoTrack();
    cameraOn = false;
    cameraElement.style.backgroundColor = "black";
  } else {
    cameraElement.style.backgroundColor = "red";
    stream = await getLocalVideoTrack();
    if(stream) {
      cameraOn = true;
      cameraElement.style.backgroundColor = "lightblue";
      addLocalVideoTrack();
    } else {
      cameraElement.style.backgroundColor = "black";
    }
  }
}


async function micClick(event) {
  if(micOn) {
    removeLocalAudioTrack();
    micOn = false;
    micElement.style.backgroundColor = "black";
  } else {
    micElement.style.backgroundColor = "red";
    stream = await getLocalAudioTrack();
    addLocalAudioTrack();
    if(stream) {
      micOn = true;
      micElement.style.backgroundColor = "lightblue";
    } else {
      micElement.style.backgroundColor = "black";
    }
  }
}


let displayStats = () => {
  document.getElementById("stats-id").textContent = "ID de sala: " + roomId;
  document.getElementById("stats-number").textContent = "Conectados: " + (streams.childElementCount);
}

cameraElement.onclick = cameraClick;
micElement.onclick = micClick;


const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

let roomId = urlParams.get('room_id');

if(roomId != null) {
  connect((success, error) => {
    if(success) {
      document.getElementById("overlay").style.display = "none";
    } else {
      alert(error);
    }
  });
}

document.getElementById("create").onclick = (event) => {
  hostId = Math.random().toString(16).substr(2, 8);
  roomId = hostId.hashCode();
  console.log(hostId);
  console.log(roomId);
  connect((success, error) => {
    if(success) {
      document.getElementById("overlay").style.display = "none";
    } else {
      alert(error);
    }
  });
};


document.getElementById("join").onclick = (event) => {
  roomId = document.getElementById("room-id").value;
  connect((success, error) => {
    if(success) {
      document.getElementById("overlay").style.display = "none";
    } else {
      alert(error);
    }
  });
};
